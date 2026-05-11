import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email dan password baru wajib diisi.' }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ success: false, message: 'Password baru minimal 6 karakter.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { user_id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Email tidak ditemukan.' }, { status: 404 });
    }

    const hashedPassword = crypto.createHash('md5').update(String(password)).digest('hex');

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset. Silakan login dengan password baru.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat memproses request.' }, { status: 500 });
  }
}
