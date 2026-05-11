import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'smj_auth';

function readAuthUser(req) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

async function runWithRetry(operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!['P2024', 'P2037'].includes(error?.code) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await runWithRetry(() =>
      prisma.user.findUnique({
        where: { user_id: authUser.user_id },
        select: {
          poin: true,
          saldoPoin: {
            select: {
              total_poin: true,
            },
          },
        },
      })
    );

    const hadiahs = await runWithRetry(() =>
      prisma.hadiah.findMany({
        where: {
          status_hadiah: 'aktif',
        },
        select: {
          hadiah_id: true,
          nama_hadiah: true,
          deskripsi: true,
          foto_contoh: true,
          poin_dibutuhkan: true,
          stok: true,
          status_hadiah: true,
        },
        orderBy: [
          { poin_dibutuhkan: 'asc' },
          { hadiah_id: 'asc' },
        ],
      })
    );

    const userPoin = user?.saldoPoin?.total_poin || user?.poin || 0;

    return NextResponse.json({
      success: true,
      poin: userPoin,
      hadiah: hadiahs.map(h => ({
        hadiah_id: Number(h.hadiah_id),
        nama_hadiah: h.nama_hadiah,
        deskripsi: h.deskripsi,
        foto_contoh: h.foto_contoh,
        poin_dibutuhkan: h.poin_dibutuhkan,
        stok: h.stok,
        status_hadiah: h.status_hadiah,
      })),
    });
  } catch (error) {
    console.error('Hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data hadiah.' }, { status: 500 });
  }
}
