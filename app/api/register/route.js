import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Cabang from '@/lib/models/Cabang';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    await dbConnect();
    const { nama, email, password, cabang_id } = await req.json();

    if (!nama || !email || !password || !cabang_id) {
      return NextResponse.json(
        { success: false, message: 'Nama, email, password, dan cabang wajib diisi.' },
        { status: 400 }
      );
    }

    const cabang = await Cabang.findOne({ _id: cabang_id, aktif: true }).select('_id');

    if (!cabang) {
      return NextResponse.json({ success: false, message: 'Cabang tidak valid atau nonaktif.' }, { status: 400 });
    }

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const user = await User.create({
      cabang_id: cabang._id,
      nama,
      email,
      password: hashedPassword,
      status_akun: 'aktif',
      poin: 0,
      tanggal_daftar: new Date(),
    });

    return NextResponse.json({ success: true, user_id: user._id.toString() });
  } catch (error) {
    if (error.code === 11000) {
      // Unique constraint violation on email
      return NextResponse.json({ success: false, message: 'Email sudah terdaftar.' }, { status: 409 });
    }
    console.error('Register error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat registrasi.' }, { status: 500 });
  }
}