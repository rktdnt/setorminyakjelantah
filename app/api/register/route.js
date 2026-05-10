import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { nama, email, password } = await req.json();

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const user = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        status_akun: 'aktif',
        poin: 0,
        tanggal_daftar: new Date(),
      },
    });

    return NextResponse.json({ success: true, user_id: Number(user.user_id) });
  } catch (error) {
    if (error.code === 'P2002') {
      // Unique constraint violation on email
      return NextResponse.json({ success: false, message: 'Email sudah terdaftar.' }, { status: 409 });
    }
    console.error('Register error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat registrasi.' }, { status: 500 });
  }
}