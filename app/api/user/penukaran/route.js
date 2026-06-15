import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Hadiah from '@/lib/models/Hadiah';
import SaldoPoin from '@/lib/models/SaldoPoin';
import PenukaranReward from '@/lib/models/PenukaranReward';
import RewardTransaksi from '@/lib/models/RewardTransaksi';
import MutasiPoint from '@/lib/models/MutasiPoint';
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
    await dbConnect();

    const items = await PenukaranReward.find({ user_id: authUser.user_id })
      .select('jumlah total_poin_dipakai status_penukaran requested_at hadiah_id')
      .populate('hadiah_id', 'nama_hadiah foto_contoh')
      .sort({ requested_at: -1 })
      .limit(20);

    const formattedItems = items.map(item => ({
      penukaran_id: item._id.toString(),
      jumlah: item.jumlah,
      total_poin_dipakai: item.total_poin_dipakai,
      status_penukaran: item.status_penukaran,
      requested_at: item.requested_at,
      nama_hadiah: item.hadiah_id?.nama_hadiah || '-',
      foto_contoh: item.hadiah_id?.foto_contoh || null,
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
  const hadiahId = body?.hadiah_id;
  const jumlah = Math.max(1, Number(body?.jumlah || 1));

  if (!hadiahId) {
    return NextResponse.json({ success: false, message: 'Hadiah tidak valid.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const session = await mongoose.startSession();
    let result;

    try {
      session.startTransaction();

      // Get hadiah
      const gift = await Hadiah.findById(hadiahId).session(session);

      if (!gift || gift.status_hadiah !== 'aktif') {
        throw new Error('HADIAH_NOT_AVAILABLE');
      }

      if ((gift.stok || 0) < jumlah) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Get user
      const user = await User.findById(authUser.user_id).session(session);

      const pointBefore = user?.poin || 0;
      const totalPoinDipakai = (gift.poin_dibutuhkan || 0) * jumlah;

      if (pointBefore < totalPoinDipakai) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      // Update user points
      await User.updateOne(
        { _id: authUser.user_id },
        { $inc: { poin: -totalPoinDipakai } },
        { session }
      );

      // Update hadiah stock
      await Hadiah.updateOne(
        { _id: hadiahId },
        { $inc: { stok: -jumlah } },
        { session }
      );

      // Create penukaran record
      const [penukaran] = await PenukaranReward.create([{
        user_id: authUser.user_id,
        hadiah_id: hadiahId,
        jumlah,
        total_poin_dipakai: totalPoinDipakai,
        status_penukaran: 'done',
        requested_at: new Date(),
        processed_at: new Date(),
      }], { session });

      // Create reward transaction
      await RewardTransaksi.create([{
        user_id: authUser.user_id,
        jenis_reward: 'penyesuaian',
        poin: -totalPoinDipakai,
        deskripsi: `Penukaran hadiah #${penukaran._id} - ${gift.nama_hadiah}`,
      }], { session });

      // Create point mutation
      const pointAfter = Math.max(0, pointBefore - totalPoinDipakai);
      await MutasiPoint.create([{
        user_id: authUser.user_id,
        jenis_mutasi: 'debit',
        referensi_tabel: 'penukaran_reward',
        referensi_id: penukaran._id,
        poin: -totalPoinDipakai,
        poin_sebelum: pointBefore,
        poin_sesudah: pointAfter,
        keterangan: `Penukaran hadiah ${gift.nama_hadiah}`,
      }], { session });

      // Update saldo poin (upsert)
      await SaldoPoin.updateOne(
        { user_id: authUser.user_id },
        {
          $set: { total_poin: pointAfter, updated_at: new Date() },
          $setOnInsert: { user_id: authUser.user_id },
        },
        { upsert: true, session }
      );

      await session.commitTransaction();

      result = {
        penukaranId: penukaran._id,
        namaHadiah: gift.nama_hadiah,
        pointBefore,
        totalPoinDipakai,
        pointAfter,
      };
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }

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
