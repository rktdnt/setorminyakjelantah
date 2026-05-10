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
    const items = await prisma.penukaranReward.findMany({
      where: {
        user_id: authUser.user_id,
      },
      select: {
        penukaran_id: true,
        jumlah: true,
        total_poin_dipakai: true,
        status_penukaran: true,
        requested_at: true,
        hadiah: {
          select: {
            nama_hadiah: true,
          },
        },
      },
      orderBy: {
        requested_at: 'desc',
      },
      take: 20,
    });

    const formattedItems = items.map(item => ({
      penukaran_id: item.penukaran_id,
      jumlah: item.jumlah,
      total_poin_dipakai: item.total_poin_dipakai,
      status_penukaran: item.status_penukaran,
      requested_at: item.requested_at,
      nama_hadiah: item.hadiah.nama_hadiah,
    }));

    return NextResponse.json({ success: true, items: formattedItems });
  } catch (error) {
    console.error('Penukaran GET error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat riwayat penukaran.' }, { status: 500 });
  }
}

export async function POST(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const hadiahId = Number(body?.hadiah_id);
  const jumlah = Math.max(1, Number(body?.jumlah || 1));

  if (!hadiahId || !Number.isFinite(hadiahId)) {
    return NextResponse.json({ success: false, message: 'Hadiah tidak valid.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get hadiah with lock
      const gift = await tx.hadiah.findUnique({
        where: { hadiah_id: hadiahId },
      });

      if (!gift || gift.status_hadiah !== 'aktif') {
        throw new Error('HADIAH_NOT_AVAILABLE');
      }

      if ((gift.stok || 0) < jumlah) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Get user with lock
      const user = await tx.user.findUnique({
        where: { user_id: authUser.user_id },
      });

      const pointBefore = user?.poin || 0;
      const totalPoinDipakai = (gift.poin_dibutuhkan || 0) * jumlah;

      if (pointBefore < totalPoinDipakai) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      // Update user points
      await tx.user.update({
        where: { user_id: authUser.user_id },
        data: {
          poin: {
            decrement: totalPoinDipakai,
          },
        },
      });

      // Update hadiah stock
      await tx.hadiah.update({
        where: { hadiah_id: hadiahId },
        data: {
          stok: {
            decrement: jumlah,
          },
        },
      });

      // Create penukaran record
      const penukaran = await tx.penukaranReward.create({
        data: {
          user_id: authUser.user_id,
          hadiah_id: hadiahId,
          jumlah,
          total_poin_dipakai: totalPoinDipakai,
          status_penukaran: 'done',
          requested_at: new Date(),
          processed_at: new Date(),
        },
      });

      // Create reward transaction
      await tx.rewardTransaksi.create({
        data: {
          user_id: authUser.user_id,
          jenis_reward: 'penyesuaian',
          poin: -totalPoinDipakai,
          deskripsi: `Penukaran hadiah #${penukaran.penukaran_id} - ${gift.nama_hadiah}`,
        },
      });

      // Create point mutation
      const pointAfter = Math.max(0, pointBefore - totalPoinDipakai);
      await tx.mutasiPoint.create({
        data: {
          user_id: authUser.user_id,
          jenis_mutasi: 'debit',
          referensi_tabel: 'penukaran_reward',
          referensi_id: penukaran.penukaran_id,
          poin: -totalPoinDipakai,
          poin_sebelum: pointBefore,
          poin_sesudah: pointAfter,
          keterangan: `Penukaran hadiah ${gift.nama_hadiah}`,
        },
      });

      // Update saldo poin
      await tx.saldoPoin.upsert({
        where: { user_id: authUser.user_id },
        update: {
          total_poin: pointAfter,
          updated_at: new Date(),
        },
        create: {
          user_id: authUser.user_id,
          total_poin: pointAfter,
        },
      });

      return {
        penukaranId: penukaran.penukaran_id,
        namaHadiah: gift.nama_hadiah,
        pointBefore,
        totalPoinDipakai,
        pointAfter,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Penukaran berhasil: ${result.namaHadiah}`,
      summary: {
        poinSebelum: result.pointBefore,
        poinDipakai: result.totalPoinDipakai,
        poinSekarang: result.pointAfter,
      },
    });
  } catch (error) {
    if (error.message === 'HADIAH_NOT_AVAILABLE') {
      return NextResponse.json({ success: false, message: 'Hadiah tidak tersedia.' }, { status: 404 });
    }
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ success: false, message: 'Stok hadiah tidak mencukupi.' }, { status: 400 });
    }
    if (error.message === 'INSUFFICIENT_POINTS') {
      return NextResponse.json({ success: false, message: 'Poin tidak cukup untuk menukar hadiah ini.' }, { status: 400 });
    }
    console.error('Penukaran POST error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses penukaran hadiah.' }, { status: 500 });
  }
}
