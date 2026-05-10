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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  try {
    const setoranIdColumn = await getSetoranIdColumn();
    const [[usersRow]] = await db.execute('SELECT COUNT(*) AS totalUsers FROM users');
    const [[pendingRow]] = await db.execute(
      "SELECT COUNT(*) AS pendingSetoran FROM setoran_minyak WHERE status_verifikasi='pending'"
    );
    const [[literRow]] = await db.execute(
      'SELECT COALESCE(SUM(jumlah_liter), 0) AS totalLiter FROM setoran_minyak'
    );

    const idSelect = setoranIdColumn ? `s.${setoranIdColumn} AS setoran_id,` : '';

    const [recentRows] = await db.execute(
      `SELECT 
        ${idSelect}
        s.user_id,
        u.nama,
        s.tanggal_setor,
        s.jumlah_liter,
        s.status_verifikasi
      FROM setoran_minyak s
      LEFT JOIN users u ON u.user_id = s.user_id
      ORDER BY s.tanggal_setor DESC
      LIMIT 8`
    );

    return NextResponse.json({
      success: true,
      canModerate: authUser.role === 'admin',
      summary: {
        totalUsers: Number(usersRow?.totalUsers || 0),
        pendingSetoran: Number(pendingRow?.pendingSetoran || 0),
        totalLiter: Number(literRow?.totalLiter || 0),
      },
      recent: recentRows,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data dashboard admin.',
      },
      { status: 500 }
    );
  }
}
