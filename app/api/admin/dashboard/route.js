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

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  try {
    const adminProfile = await runWithRetry(() =>
      prisma.user.findUnique({
        where: { user_id: authUser.user_id },
        select: {
          cabang: {
            select: {
              nama_cabang: true,
              alamat: true,
            },
          },
        },
      })
    );

    const totalUsers = await runWithRetry(() => prisma.user.count());

    const pendingSetoran = await runWithRetry(() =>
      prisma.setoranMinyak.count({
        where: { status_verifikasi: 'pending' },
      })
    );

    const totalLiterResult = await runWithRetry(() =>
      prisma.setoranMinyak.aggregate({
        _sum: { jumlah_liter: true },
      })
    );

    const recentSetoran = await runWithRetry(() =>
      prisma.setoranMinyak.findMany({
        select: {
          setoran_id: true,
          user_id: true,
          tanggal_setor: true,
          jumlah_liter: true,
          status_verifikasi: true,
          user: {
            select: {
              nama: true,
            },
          },
        },
        orderBy: { tanggal_setor: 'desc' },
        take: 8,
      })
    );

    const totalLiter = totalLiterResult._sum.jumlah_liter || 0;

    return NextResponse.json({
      success: true,
      canModerate: authUser.role === 'admin',
      admin: {
        cabangLabel: adminProfile?.cabang
          ? `${adminProfile.cabang.nama_cabang}${adminProfile.cabang.alamat ? ` - ${adminProfile.cabang.alamat}` : ''}`
          : 'Cabang belum ditentukan',
      },
      summary: {
        totalUsers,
        pendingSetoran,
        totalLiter: parseFloat(totalLiter.toString()),
      },
      recent: recentSetoran.map(item => ({
        setoran_id: Number(item.setoran_id),
        user_id: Number(item.user_id),
        nama: item.user?.nama,
        tanggal_setor: item.tanggal_setor,
        jumlah_liter: parseFloat(item.jumlah_liter.toString()),
        status_verifikasi: item.status_verifikasi,
      })),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data dashboard admin.',
      },
      { status: 500 }
    );
  }
}
