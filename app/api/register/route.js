import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { nama, email, password } = await req.json();

  try {
    await db.execute(
      "INSERT INTO users (nama,email,password,tanggal_daftar,status_akun,poin) VALUES (?,?,MD5(?),NOW(),'aktif',0)",
      [nama, email, password]
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, message: 'Email sudah terdaftar.' }, { status: 409 });
    }

    return NextResponse.json({ success: false, message: 'Gagal membuat user baru.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}