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

const formatRelativeTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
};

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
          user_id: true,
          nama: true,
          email: true,
          status_akun: true,
          cabang: {
            select: {
              nama_cabang: true,
              alamat: true,
            },
          },
          poin: true,
          saldoPoin: {
            select: {
              total_poin: true,
            },
          },
        },
      })
    );

    const recentSetoran = await runWithRetry(() =>
      prisma.setoranMinyak.findMany({
        where: { user_id: authUser.user_id },
        select: {
          jumlah_liter: true,
          status_verifikasi: true,
          tanggal_setor: true,
          poin_didapat: true,
        },
        orderBy: { tanggal_setor: 'desc' },
        take: 3,
      })
    );

    const recentPenukaran = await runWithRetry(() =>
      prisma.penukaranReward.findMany({
        where: { user_id: authUser.user_id },
        select: {
          total_poin_dipakai: true,
          status_penukaran: true,
          requested_at: true,
          hadiah: {
            select: {
              nama_hadiah: true,
            },
          },
        },
        orderBy: { requested_at: 'desc' },
        take: 3,
      })
    );

    const pendingAgg = await runWithRetry(() =>
      prisma.setoranMinyak.aggregate({
        where: {
          user_id: authUser.user_id,
          status_verifikasi: 'pending',
        },
        _sum: {
          jumlah_liter: true,
        },
      })
    );

    const approvedAgg = await runWithRetry(() =>
      prisma.setoranMinyak.aggregate({
        where: {
          user_id: authUser.user_id,
          status_verifikasi: 'approved',
        },
        _sum: {
          jumlah_liter: true,
        },
      })
    );

    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
    }

    const userPoin = user.saldoPoin?.total_poin || user.poin || 0;
    const pendingLiter = parseFloat((pendingAgg._sum.jumlah_liter || 0).toString());
    const approvedLiter = parseFloat((approvedAgg._sum.jumlah_liter || 0).toString());

    const activity = [
      ...recentSetoran.map((item) => ({
        title: `Setor ${parseFloat(item.jumlah_liter.toString()).toFixed(1)} L minyak`,
        meta: `${formatRelativeTime(item.tanggal_setor)} • ${item.status_verifikasi || 'pending'}`,
        tone: item.status_verifikasi === 'approved' ? 'ok' : item.status_verifikasi === 'rejected' ? 'reject' : 'warn',
      })),
      ...recentPenukaran.map((item) => ({
        title: `Tukar hadiah ${item.hadiah.nama_hadiah}`,
        meta: `${formatRelativeTime(item.requested_at)} • ${item.total_poin_dipakai} poin`,
        tone: item.status_penukaran === 'done' ? 'ok' : 'warn',
      })),
    ]
      .sort((left, right) => String(right.meta).localeCompare(String(left.meta)))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      user: {
        user_id: Number(user.user_id),
        nama: user.nama,
        email: user.email,
        status_akun: user.status_akun,
        cabang_label: user.cabang
          ? `${user.cabang.nama_cabang}${user.cabang.alamat ? ` - ${user.cabang.alamat}` : ''}`
          : 'Cabang belum ditentukan',
      },
      summary: {
        poin: userPoin,
        pendingLiter,
        approvedLiter,
      },
      activity,
      pointsApplied: true,
    });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat ringkasan user.' },
      { status: 500 }
    );
  }
}
