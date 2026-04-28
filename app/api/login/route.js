import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { email, password } = await req.json();

  const [rows] = await db.execute(
    `SELECT user_id, nama, email, status_akun, poin, tanggal_daftar
     FROM users
     WHERE email=?
       AND (password=? OR password=MD5(?))
     LIMIT 1`,
    [email, password, password]
  );

  if (rows.length > 0) {
    const user = rows[0];
    const role = user.role || (['petugas', 'admin'].includes(user.status_akun) ? 'admin' : 'user');
    const response = NextResponse.json({
      success: true,
      user: {
        ...user,
        role,
      },
    });

    response.cookies.set('smj_auth', encodeURIComponent(JSON.stringify({
      user_id: user.user_id,
      nama: user.nama,
      email: user.email,
      role,
    })), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  return NextResponse.json({ success: false });
}