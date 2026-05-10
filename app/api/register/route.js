import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { nama, email, password } = await req.json();

  const [result] = await db.execute(
    "INSERT INTO users (nama, email, password, tanggal_daftar, status_akun, poin) VALUES (?, ?, md5(?), CURRENT_TIMESTAMP, 'aktif', 0) ON CONFLICT (email) DO NOTHING",
    [nama, email, password]
  );

  if (!result.rowCount) {
    return NextResponse.json({ success: false, message: 'Email sudah terdaftar.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}