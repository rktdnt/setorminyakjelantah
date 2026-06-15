import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import SetoranMinyak from '@/lib/models/SetoranMinyak';
import RewardRule from '@/lib/models/RewardRule';
import SaldoPoin from '@/lib/models/SaldoPoin';
import RewardTransaksi from '@/lib/models/RewardTransaksi';
import MutasiPoint from '@/lib/models/MutasiPoint';
import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'smj_auth';
const POINTS_PER_LITER = 10;

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

async function pickRewardRule(liter) {
  const rule = await RewardRule.findOne({
    aktif: true,
    minimal_liter: { $lte: liter },
  })
    .sort({ minimal_liter: -1 });

  return rule || null;
}

export async function PATCH(req) {
  const authUser = readAuthUser(req);

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  const { setoranId, action } = await req.json();
  const normalizedAction = String(action || '').toLowerCase();

  if (!setoranId || !['approve', 'reject'].includes(normalizedAction)) {
    return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const nextStatus = normalizedAction === 'approve' ? 'approved' : 'rejected';

  try {
    await dbConnect();
    const session = await mongoose.startSession();
    let result;

    try {
      session.startTransaction();

      // Get the setoran
      const currentSetoran = await SetoranMinyak.findById(setoranId).session(session);

      if (!currentSetoran) {
        throw new Error('SETORAN_NOT_FOUND');
      }

      const previousStatus = currentSetoran.status_verifikasi;
      const liter = parseFloat(currentSetoran.jumlah_liter);

      // Get user's current points
      const user = await User.findById(currentSetoran.user_id).session(session);
      const currentPoint = user?.poin || 0;

      // Pick reward rule if approving
      const matchedRule = nextStatus === 'approved' ? await pickRewardRule(liter) : null;
      const computedPoints = matchedRule
        ? Math.max(
            0,
            Math.round(liter * (matchedRule.poin_per_liter || POINTS_PER_LITER) + (matchedRule.bonus_poin || 0))
          )
        : Math.max(0, Math.round(liter * POINTS_PER_LITER));

      // Update setoran status
      if (previousStatus !== nextStatus) {
        await SetoranMinyak.updateOne(
          { _id: setoranId },
          {
            status_verifikasi: nextStatus,
            verified_at: new Date(),
            verified_by: authUser.user_id,
            poin_didapat: nextStatus === 'approved' ? computedPoints : 0,
            rule_id: nextStatus === 'approved' ? matchedRule?._id || null : null,
          },
          { session }
        );
      }

      let pointsDelta = 0;

      const previousAward = currentSetoran.poin_didapat || Math.max(0, Math.round(liter * POINTS_PER_LITER));

      if (previousStatus !== 'approved' && nextStatus === 'approved') {
        pointsDelta = computedPoints;

        // Update user points
        await User.updateOne(
          { _id: currentSetoran.user_id },
          { $inc: { poin: computedPoints } },
          { session }
        );

        // Create reward transaction
        await RewardTransaksi.create([{
          user_id: currentSetoran.user_id,
          rule_id: matchedRule?._id || null,
          setoran_id: setoranId,
          jenis_reward: 'setoran',
          poin: computedPoints,
          deskripsi: `Reward verifikasi setoran #${setoranId}`,
        }], { session });

        // Create point mutation
        await MutasiPoint.create([{
          user_id: currentSetoran.user_id,
          jenis_mutasi: 'credit',
          referensi_tabel: 'setoran_minyak',
          referensi_id: currentSetoran._id,
          poin: computedPoints,
          poin_sebelum: currentPoint,
          poin_sesudah: currentPoint + computedPoints,
          keterangan: `Credit poin dari verifikasi setoran #${setoranId}`,
        }], { session });
      }

      if (previousStatus === 'approved' && nextStatus !== 'approved') {
        pointsDelta = -previousAward;
        const safeDeduction = Math.max(0, previousAward);

        // Update user points (deduct)
        await User.updateOne(
          { _id: currentSetoran.user_id },
          { $inc: { poin: -safeDeduction } },
          { session }
        );

        // Create reward transaction (reversal)
        await RewardTransaksi.create([{
          user_id: currentSetoran.user_id,
          rule_id: currentSetoran.rule_id || null,
          setoran_id: setoranId,
          jenis_reward: 'penyesuaian',
          poin: -safeDeduction,
          deskripsi: `Reversal poin karena perubahan status setoran #${setoranId}`,
        }], { session });

        // Create point mutation (debit)
        await MutasiPoint.create([{
          user_id: currentSetoran.user_id,
          jenis_mutasi: 'debit',
          referensi_tabel: 'setoran_minyak',
          referensi_id: currentSetoran._id,
          poin: safeDeduction,
          poin_sebelum: currentPoint,
          poin_sesudah: Math.max(0, currentPoint - safeDeduction),
          keterangan: `Debit poin dari pembatalan approve setoran #${setoranId}`,
        }], { session });
      }

      // Update saldo poin (upsert)
      await SaldoPoin.updateOne(
        { user_id: currentSetoran.user_id },
        {
          $set: { total_poin: currentPoint + pointsDelta, updated_at: new Date() },
          $setOnInsert: { user_id: currentSetoran.user_id },
        },
        { upsert: true, session }
      );

      await session.commitTransaction();
      result = { pointsDelta };
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      pointsDelta: result.pointsDelta,
      pointsApplied: true,
    });
  } catch (error) {
    if (error.message === 'SETORAN_NOT_FOUND') {
      return NextResponse.json({ success: false, message: 'Data setoran tidak ditemukan.' }, { status: 404 });
    }
    console.error('Setoran approval error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses verifikasi setoran.' }, { status: 500 });
  }
}
