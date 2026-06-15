import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Email atau password salah.' }, { status: 401 });
    }

    // Check if password matches MD5 hash or plain text (for migration)
    if (user.password !== hashedPassword) {
      return NextResponse.json({ success: false, message: 'Email atau password salah.' }, { status: 401 });
    }

    const role = ['petugas', 'admin'].includes(user.status_akun) ? 'admin' : 'user';
    const response = NextResponse.json({
      success: true,
      user: {
        user_id: user._id.toString(),
        nama: user.nama,
        email: user.email,
        status_akun: user.status_akun,
        poin: user.poin,
        tanggal_daftar: user.tanggal_daftar,
        role,
      },
    });

    response.cookies.set('smj_auth', encodeURIComponent(JSON.stringify({
      user_id: user._id.toString(),
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
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat login.' }, { status: 500 });
  }
}