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

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  try {
    const [totalUsers, pendingSetoran, totalLiterResult, recentSetoran] = await Promise.all([
      prisma.user.count(),
      prisma.setoranMinyak.count({
        where: { status_verifikasi: 'pending' },
      }),
      prisma.setoranMinyak.aggregate({
        _sum: { jumlah_liter: true },
      }),
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
      }),
    ]);

    const totalLiter = totalLiterResult._sum.jumlah_liter || 0;

    return NextResponse.json({
      success: true,
      canModerate: authUser.role === 'admin',
      summary: {
        totalUsers,
        pendingSetoran,
        totalLiter: parseFloat(totalLiter.toString()),
      },
      recent: recentSetoran.map(item => ({
        setoran_id: item.setoran_id,
        user_id: item.user_id,
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
