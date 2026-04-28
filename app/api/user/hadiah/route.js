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
     WHERE TABLE_SCHEMA = DATABASE()
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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pointColumn = await getUserPointColumn();
    const userPointSelect = pointColumn ? `COALESCE(u.${pointColumn}, 0)` : '0';

    const [[userRow]] = await db.execute(
      `SELECT
         COALESCE(sp.total_poin, ${userPointSelect}) AS poin
       FROM users u
       LEFT JOIN saldo_poin sp ON sp.user_id = u.user_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [authUser.user_id]
    );

    const [giftRows] = await db.execute(
      `SELECT hadiah_id, nama_hadiah, deskripsi, poin_dibutuhkan, stok, status_hadiah
       FROM hadiah
       WHERE status_hadiah = 'aktif'
       ORDER BY poin_dibutuhkan ASC, hadiah_id ASC`
    );

    return NextResponse.json({
      success: true,
      poin: Number(userRow?.poin || 0),
      hadiah: giftRows,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Gagal memuat data hadiah.' }, { status: 500 });
  }
}
