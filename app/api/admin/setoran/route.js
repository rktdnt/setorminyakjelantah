import { prisma } from '@/lib/prisma';
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
  const rule = await prisma.rewardRule.findFirst({
    where: {
      aktif: true,
      minimal_liter: {
        lte: liter,
      },
    },
    orderBy: {
      minimal_liter: 'desc',
    },
  });

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
    const result = await prisma.$transaction(async (tx) => {
      // Get the setoran with lock
      const currentSetoran = await tx.setoranMinyak.findUnique({
        where: { setoran_id: setoranId },
      });

      if (!currentSetoran) {
        throw new Error('SETORAN_NOT_FOUND');
      }

      const previousStatus = currentSetoran.status_verifikasi;
      const liter = parseFloat(currentSetoran.jumlah_liter);

      // Get user's current points
      const user = await tx.user.findUnique({
        where: { user_id: currentSetoran.user_id },
      });

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
        await tx.setoranMinyak.update({
          where: { setoran_id: setoranId },
          data: {
            status_verifikasi: nextStatus,
            verified_at: new Date(),
            verified_by: authUser.user_id,
            poin_didapat: nextStatus === 'approved' ? computedPoints : 0,
            rule_id: nextStatus === 'approved' ? matchedRule?.rule_id || null : null,
          },
        });
      }

      let pointsDelta = 0;

      const previousAward = currentSetoran.poin_didapat || Math.max(0, Math.round(liter * POINTS_PER_LITER));

      if (previousStatus !== 'approved' && nextStatus === 'approved') {
        pointsDelta = computedPoints;

        // Update user points
        await tx.user.update({
          where: { user_id: currentSetoran.user_id },
          data: {
            poin: {
              increment: computedPoints,
            },
          },
        });

        // Create reward transaction
        await tx.rewardTransaksi.create({
          data: {
            user_id: currentSetoran.user_id,
            rule_id: matchedRule?.rule_id || null,
            setoran_id: setoranId,
            jenis_reward: 'setoran',
            poin: computedPoints,
            deskripsi: `Reward verifikasi setoran #${setoranId}`,
          },
        });

        // Create point mutation
        await tx.mutasiPoint.create({
          data: {
            user_id: currentSetoran.user_id,
            jenis_mutasi: 'credit',
            referensi_tabel: 'setoran_minyak',
            referensi_id: setoranId,
            poin: computedPoints,
            poin_sebelum: currentPoint,
            poin_sesudah: currentPoint + computedPoints,
            keterangan: `Credit poin dari verifikasi setoran #${setoranId}`,
          },
        });
      }

      if (previousStatus === 'approved' && nextStatus !== 'approved') {
        pointsDelta = -previousAward;
        const safeDeduction = Math.max(0, previousAward);

        // Update user points (deduct)
        await tx.user.update({
          where: { user_id: currentSetoran.user_id },
          data: {
            poin: {
              increment: -safeDeduction,
            },
          },
        });

        // Create reward transaction (reversal)
        await tx.rewardTransaksi.create({
          data: {
            user_id: currentSetoran.user_id,
            rule_id: currentSetoran.rule_id || null,
            setoran_id: setoranId,
            jenis_reward: 'penyesuaian',
            poin: -safeDeduction,
            deskripsi: `Reversal poin karena perubahan status setoran #${setoranId}`,
          },
        });

        // Create point mutation (debit)
        await tx.mutasiPoint.create({
          data: {
            user_id: currentSetoran.user_id,
            jenis_mutasi: 'debit',
            referensi_tabel: 'setoran_minyak',
            referensi_id: setoranId,
            poin: safeDeduction,
            poin_sebelum: currentPoint,
            poin_sesudah: Math.max(0, currentPoint - safeDeduction),
            keterangan: `Debit poin dari pembatalan approve setoran #${setoranId}`,
          },
        });
      }

      // Update saldo poin
      await tx.saldoPoin.upsert({
        where: { user_id: currentSetoran.user_id },
        update: {
          total_poin: currentPoint + pointsDelta,
          updated_at: new Date(),
        },
        create: {
          user_id: currentSetoran.user_id,
          total_poin: currentPoint + pointsDelta,
        },
      });

      return { pointsDelta };
    });

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
