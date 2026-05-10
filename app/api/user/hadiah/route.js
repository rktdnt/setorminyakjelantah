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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user, hadiahs] = await Promise.all([
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
      }),
      prisma.hadiah.findMany({
        where: {
          status_hadiah: 'aktif',
        },
        select: {
          hadiah_id: true,
          nama_hadiah: true,
          deskripsi: true,
          poin_dibutuhkan: true,
          stok: true,
          status_hadiah: true,
        },
        orderBy: [
          { poin_dibutuhkan: 'asc' },
          { hadiah_id: 'asc' },
        ],
      }),
    ]);

    const userPoin = user?.saldoPoin?.total_poin || user?.poin || 0;

    return NextResponse.json({
      success: true,
      poin: userPoin,
      hadiah: hadiahs.map(h => ({
        hadiah_id: Number(h.hadiah_id),
        nama_hadiah: h.nama_hadiah,
        deskripsi: h.deskripsi,
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
