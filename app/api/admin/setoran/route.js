import { db } from '@/lib/db';
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

async function getSetoranIdColumn() {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = current_schema()
       AND TABLE_NAME = 'setoran_minyak'
       AND COLUMN_NAME IN ('setoran_id', 'id_setoran', 'id')
     ORDER BY CASE COLUMN_NAME
       WHEN 'setoran_id' THEN 1
       WHEN 'id_setoran' THEN 2
       WHEN 'id' THEN 3
       ELSE 99 END
     LIMIT 1`
  );

  return columns[0]?.COLUMN_NAME || null;
}

async function getUserPointColumn() {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = current_schema()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('poin', 'points', 'total_poin', 'jumlah_poin', 'poin_user')
     ORDER BY CASE COLUMN_NAME
       WHEN 'poin' THEN 1
       WHEN 'points' THEN 2
       WHEN 'total_poin' THEN 3
       WHEN 'jumlah_poin' THEN 4
       WHEN 'poin_user' THEN 5
       ELSE 99 END
     LIMIT 1`
  );

  return columns[0]?.COLUMN_NAME || null;
}

async function pickRewardRule(liter) {
  const [ruleRows] = await db.execute(
    `SELECT rule_id, minimal_liter, poin_per_liter, bonus_poin
     FROM reward_rule
     WHERE aktif = 1
       AND minimal_liter <= ?
     ORDER BY minimal_liter DESC
     LIMIT 1`,
    [liter]
  );

  return ruleRows[0] || null;
}

async function syncSaldoPoint(userId, pointColumn) {
  if (!pointColumn) {
    return;
  }

  await db.execute(
    `INSERT INTO saldo_poin (user_id, total_poin)
     VALUES (
       ?,
       (SELECT COALESCE(${pointColumn}, 0) FROM users WHERE user_id = ?)
     )
     ON CONFLICT (user_id) DO UPDATE
       SET total_poin = EXCLUDED.total_poin,
           updated_at = CURRENT_TIMESTAMP`,
    [userId, userId]
  );
}

async function writePointMutation({ userId, delta, before, after, refId, note }) {
  if (!delta) {
    return;
  }

  await db.execute(
    `INSERT INTO mutasi_point
      (user_id, jenis_mutasi, referensi_tabel, referensi_id, poin, poin_sebelum, poin_sesudah, keterangan)
     VALUES (?, ?, 'setoran_minyak', ?, ?, ?, ?, ?)`,
    [userId, delta > 0 ? 'credit' : 'debit', refId, delta, before, after, note]
  );
}

async function writeRewardTransaksi({ userId, delta, ruleId, setoranId, note }) {
  if (!delta) {
    return;
  }

  await db.execute(
    `INSERT INTO reward_transaksi (user_id, rule_id, setoran_id, jenis_reward, poin, deskripsi)
     VALUES (?, ?, ?, 'setoran', ?, ?)`,
    [userId, ruleId, setoranId, delta, note]
  );
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

  const setoranIdColumn = await getSetoranIdColumn();
  const userPointColumn = await getUserPointColumn();

  if (!setoranIdColumn) {
    return NextResponse.json(
      { success: false, message: 'Kolom ID setoran tidak ditemukan.' },
      { status: 500 }
    );
  }

  const nextStatus = normalizedAction === 'approve' ? 'approved' : 'rejected';

  await db.beginTransaction();

  try {
    const [setoranRows] = await db.execute(
      `SELECT user_id, jumlah_liter, status_verifikasi, poin_didapat, rule_id
       FROM setoran_minyak
       WHERE ${setoranIdColumn}=?
       FOR UPDATE`,
      [setoranId]
    );

    const currentSetoran = setoranRows[0];

    if (!currentSetoran) {
      await db.rollback();
      return NextResponse.json({ success: false, message: 'Data setoran tidak ditemukan.' }, { status: 404 });
    }

    const previousStatus = String(currentSetoran.status_verifikasi || '').toLowerCase();
    const liter = Number(currentSetoran.jumlah_liter || 0);

    const [userRows] = await db.execute(
      `SELECT COALESCE(${userPointColumn || '0'}, 0) AS currentPoint
       FROM users
       WHERE user_id = ?
       FOR UPDATE`,
      [currentSetoran.user_id]
    );

    const currentPoint = Number(userRows[0]?.currentPoint || 0);

    const matchedRule = nextStatus === 'approved' ? await pickRewardRule(liter) : null;
    const computedPoints = matchedRule
      ? Math.max(0, Math.round(liter * Number(matchedRule.poin_per_liter || POINTS_PER_LITER) + Number(matchedRule.bonus_poin || 0)))
      : Math.max(0, Math.round(liter * POINTS_PER_LITER));

    if (previousStatus !== nextStatus) {
      await db.execute(
        `UPDATE setoran_minyak
         SET status_verifikasi=?,
             verified_at = CURRENT_TIMESTAMP,
             verified_by = ?,
             poin_didapat = ?,
             rule_id = ?
         WHERE ${setoranIdColumn}=?`,
        [
          nextStatus,
          authUser.user_id,
          nextStatus === 'approved' ? computedPoints : 0,
          nextStatus === 'approved' ? matchedRule?.rule_id || null : null,
          setoranId,
        ]
      );
    }

    let pointsDelta = 0;

    if (userPointColumn) {
      const previousAward = Number(currentSetoran.poin_didapat || 0) || Math.max(0, Math.round(liter * POINTS_PER_LITER));

      if (previousStatus !== 'approved' && nextStatus === 'approved') {
        pointsDelta = computedPoints;

        await db.execute(
          `UPDATE users
           SET ${userPointColumn} = COALESCE(${userPointColumn}, 0) + ?
           WHERE user_id = ?`,
          [computedPoints, currentSetoran.user_id]
        );

        await writeRewardTransaksi({
          userId: currentSetoran.user_id,
          delta: computedPoints,
          ruleId: matchedRule?.rule_id || null,
          setoranId,
          note: `Reward verifikasi setoran #${setoranId}`,
        });

        await writePointMutation({
          userId: currentSetoran.user_id,
          delta: computedPoints,
          before: currentPoint,
          after: currentPoint + computedPoints,
          refId: setoranId,
          note: `Credit poin dari verifikasi setoran #${setoranId}`,
        });
      }

      if (previousStatus === 'approved' && nextStatus !== 'approved') {
        pointsDelta = -previousAward;
        const safeDeduction = Math.max(0, previousAward);

        await db.execute(
          `UPDATE users
           SET ${userPointColumn} = GREATEST(0, COALESCE(${userPointColumn}, 0) - ?)
           WHERE user_id = ?`,
          [safeDeduction, currentSetoran.user_id]
        );

        await writeRewardTransaksi({
          userId: currentSetoran.user_id,
          delta: -safeDeduction,
          ruleId: currentSetoran.rule_id || null,
          setoranId,
          note: `Reversal poin karena perubahan status setoran #${setoranId}`,
        });

        await writePointMutation({
          userId: currentSetoran.user_id,
          delta: -safeDeduction,
          before: currentPoint,
          after: Math.max(0, currentPoint - safeDeduction),
          refId: setoranId,
          note: `Debit poin dari pembatalan approve setoran #${setoranId}`,
        });
      }

      await syncSaldoPoint(currentSetoran.user_id, userPointColumn);
    }

    await db.commit();

    return NextResponse.json({
      success: true,
      status: nextStatus,
      pointsDelta,
      pointsApplied: userPointColumn !== null,
    });
  } catch {
    await db.rollback();
    return NextResponse.json({ success: false, message: 'Gagal memproses verifikasi setoran.' }, { status: 500 });
  }
}
