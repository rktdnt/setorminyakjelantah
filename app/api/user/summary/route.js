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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pointColumn = await getUserPointColumn();
    const pointSelect = pointColumn ? `COALESCE(u.${pointColumn}, 0)` : '0';

    const [userRows] = await db.execute(
      `SELECT
         u.user_id,
         u.nama,
         u.email,
         u.status_akun,
         COALESCE(sp.total_poin, ${pointSelect}) AS poin
       FROM users u
       LEFT JOIN saldo_poin sp ON sp.user_id = u.user_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [authUser.user_id]
    );

    const user = userRows[0];

    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
    }

    const [[pendingRow]] = await db.execute(
      `SELECT COALESCE(SUM(jumlah_liter), 0) AS pendingLiter
       FROM setoran_minyak
       WHERE user_id = ? AND status_verifikasi = 'pending'`,
      [authUser.user_id]
    );

    const [[approvedRow]] = await db.execute(
      `SELECT COALESCE(SUM(jumlah_liter), 0) AS approvedLiter
       FROM setoran_minyak
       WHERE user_id = ? AND status_verifikasi = 'approved'`,
      [authUser.user_id]
    );

    const [recentSetoranRows] = await db.execute(
      `SELECT
         jumlah_liter,
         status_verifikasi,
         tanggal_setor,
         poin_didapat
       FROM setoran_minyak
       WHERE user_id = ?
       ORDER BY tanggal_setor DESC
       LIMIT 3`,
      [authUser.user_id]
    );

    const [recentPenukaranRows] = await db.execute(
      `SELECT
         pr.total_poin_dipakai,
         pr.status_penukaran,
         pr.requested_at,
         h.nama_hadiah
       FROM penukaran_reward pr
       JOIN hadiah h ON h.hadiah_id = pr.hadiah_id
       WHERE pr.user_id = ?
       ORDER BY pr.requested_at DESC
       LIMIT 3`,
      [authUser.user_id]
    );

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

    const activity = [
      ...recentSetoranRows.map((item) => ({
        title: `Setor ${Number(item.jumlah_liter || 0).toFixed(1)} L minyak`,
        meta: `${formatRelativeTime(item.tanggal_setor)} • ${item.status_verifikasi || 'pending'}`,
        tone: item.status_verifikasi === 'approved' ? 'ok' : item.status_verifikasi === 'rejected' ? 'reject' : 'warn',
      })),
      ...recentPenukaranRows.map((item) => ({
        title: `Tukar hadiah ${item.nama_hadiah}`,
        meta: `${formatRelativeTime(item.requested_at)} • ${Number(item.total_poin_dipakai || 0)} poin`,
        tone: item.status_penukaran === 'done' ? 'ok' : 'warn',
      })),
    ]
      .sort((left, right) => String(right.meta).localeCompare(String(left.meta)))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        nama: user.nama,
        email: user.email,
        status_akun: user.status_akun,
      },
      summary: {
        poin: Number(user.poin || 0),
        pendingLiter: Number(pendingRow?.pendingLiter || 0),
        approvedLiter: Number(approvedRow?.approvedLiter || 0),
      },
      activity,
      pointsApplied: pointColumn !== null,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Gagal memuat ringkasan user.' },
      { status: 500 }
    );
  }
}
