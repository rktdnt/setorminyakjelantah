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

function ensureAdmin(req) {
  const authUser = readAuthUser(req);

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  return null;
}

async function runWithRetry(operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (error?.code !== 'P2024' || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

export async function GET(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    const hadiah = await prisma.hadiah.findMany({
      orderBy: { hadiah_id: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: hadiah.map((item) => ({
        ...item,
        hadiah_id: Number(item.hadiah_id),
      })),
    });
  } catch (error) {
    console.error('Get hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data hadiah.' }, { status: 500 });
  }
}

export async function POST(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    const { nama_hadiah, poin_dibutuhkan, stok = 0, deskripsi = '', foto_contoh = null } = await req.json();

    if (!nama_hadiah || !poin_dibutuhkan) {
      return NextResponse.json(
        { success: false, message: 'Nama hadiah dan poin dibutuhkan wajib diisi.' },
        { status: 400 }
      );
    }

    const created = await runWithRetry(() =>
      prisma.hadiah.create({
        data: {
          nama_hadiah,
          poin_dibutuhkan: Number(poin_dibutuhkan),
          stok: Number(stok),
          deskripsi,
          foto_contoh: foto_contoh || null,
          status_hadiah: 'aktif',
        },
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        hadiah_id: Number(created.hadiah_id),
      },
    });
  } catch (error) {
    console.error('Create hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal menambahkan hadiah.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    const { hadiah_id, status_hadiah } = await req.json();
    const normalizedStatus = String(status_hadiah || '').toLowerCase();

    if (!hadiah_id || !['aktif', 'nonaktif'].includes(normalizedStatus)) {
      return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const updated = await prisma.hadiah.update({
      where: { hadiah_id: BigInt(hadiah_id) },
      data: {
        status_hadiah: normalizedStatus,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        hadiah_id: Number(updated.hadiah_id),
      },
    });
  } catch (error) {
    console.error('Update hadiah status error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengubah status hadiah.' }, { status: 500 });
  }
}
