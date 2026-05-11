import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { nama, email, password, cabang_id } = await req.json();

    const parsedCabangId = Number(cabang_id);

    if (!nama || !email || !password || !parsedCabangId) {
      return NextResponse.json(
        { success: false, message: 'Nama, email, password, dan cabang wajib diisi.' },
        { status: 400 }
      );
    }

    const cabang = await prisma.cabang.findFirst({
      where: {
        cabang_id: BigInt(parsedCabangId),
        aktif: true,
      },
      select: { cabang_id: true },
    });

    if (!cabang) {
      return NextResponse.json({ success: false, message: 'Cabang tidak valid atau nonaktif.' }, { status: 400 });
    }

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const user = await prisma.user.create({
      data: {
        cabang_id: BigInt(parsedCabangId),
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