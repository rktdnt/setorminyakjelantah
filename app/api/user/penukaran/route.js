import { db } from '@/lib/db';
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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [rows] = await db.execute(
      `SELECT
         pr.penukaran_id,
         pr.jumlah,
         pr.total_poin_dipakai,
         pr.status_penukaran,
         pr.requested_at,
         h.nama_hadiah
       FROM penukaran_reward pr
       JOIN hadiah h ON h.hadiah_id = pr.hadiah_id
       WHERE pr.user_id = ?
       ORDER BY pr.requested_at DESC
       LIMIT 20`,
      [authUser.user_id]
    );

    return NextResponse.json({ success: true, items: rows });
  } catch {
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

  const pointColumn = await getUserPointColumn();

  if (!pointColumn) {
    return NextResponse.json(
      { success: false, message: 'Kolom poin user belum tersedia di database.' },
      { status: 500 }
    );
  }

  await db.beginTransaction();

  try {
    const [[giftRow]] = await db.execute(
      `SELECT hadiah_id, nama_hadiah, poin_dibutuhkan, stok, status_hadiah
       FROM hadiah
       WHERE hadiah_id = ?
       FOR UPDATE`,
      [hadiahId]
    );

    if (!giftRow || giftRow.status_hadiah !== 'aktif') {
      await db.rollback();
      return NextResponse.json({ success: false, message: 'Hadiah tidak tersedia.' }, { status: 404 });
    }

    if (Number(giftRow.stok || 0) < jumlah) {
      await db.rollback();
      return NextResponse.json({ success: false, message: 'Stok hadiah tidak mencukupi.' }, { status: 400 });
    }

    const [[userRow]] = await db.execute(
      `SELECT COALESCE(${pointColumn}, 0) AS poin
       FROM users
       WHERE user_id = ?
       FOR UPDATE`,
      [authUser.user_id]
    );

    const pointBefore = Number(userRow?.poin || 0);
    const totalPoinDipakai = Number(giftRow.poin_dibutuhkan || 0) * jumlah;

    if (pointBefore < totalPoinDipakai) {
      await db.rollback();
      return NextResponse.json({ success: false, message: 'Poin tidak cukup untuk menukar hadiah ini.' }, { status: 400 });
    }

    await db.execute(
      `UPDATE users
       SET ${pointColumn} = GREATEST(0, COALESCE(${pointColumn}, 0) - ?)
       WHERE user_id = ?`,
      [totalPoinDipakai, authUser.user_id]
    );

    await db.execute(
      `UPDATE hadiah
       SET stok = GREATEST(0, stok - ?)
       WHERE hadiah_id = ?`,
      [jumlah, hadiahId]
    );

    const [insertPenukaran] = await db.execute(
      `INSERT INTO penukaran_reward
        (user_id, hadiah_id, jumlah, total_poin_dipakai, status_penukaran, requested_at, processed_at, processed_by)
       VALUES (?, ?, ?, ?, 'done', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
       RETURNING penukaran_id`,
      [authUser.user_id, hadiahId, jumlah, totalPoinDipakai]
    );

    const penukaranId = insertPenukaran[0]?.penukaran_id;
    const pointAfter = Math.max(0, pointBefore - totalPoinDipakai);

    await db.execute(
      `INSERT INTO reward_transaksi (user_id, rule_id, setoran_id, jenis_reward, poin, deskripsi)
       VALUES (?, NULL, NULL, 'penyesuaian', ?, ?)`,
      [authUser.user_id, -totalPoinDipakai, `Penukaran hadiah #${penukaranId} - ${giftRow.nama_hadiah}`]
    );

    await db.execute(
      `INSERT INTO mutasi_point
        (user_id, jenis_mutasi, referensi_tabel, referensi_id, poin, poin_sebelum, poin_sesudah, keterangan)
       VALUES (?, 'debit', 'penukaran_reward', ?, ?, ?, ?, ?)`,
      [
        authUser.user_id,
        penukaranId,
        -totalPoinDipakai,
        pointBefore,
        pointAfter,
        `Penukaran hadiah ${giftRow.nama_hadiah}`,
      ]
    );

    await syncSaldoPoint(authUser.user_id, pointColumn);

    await db.commit();

    return NextResponse.json({
      success: true,
      message: `Penukaran berhasil: ${giftRow.nama_hadiah}`,
      summary: {
        poinSebelum: pointBefore,
        poinDipakai: totalPoinDipakai,
        poinSekarang: pointAfter,
      },
    });
  } catch {
    await db.rollback();
    return NextResponse.json({ success: false, message: 'Gagal memproses penukaran hadiah.' }, { status: 500 });
  }
}
