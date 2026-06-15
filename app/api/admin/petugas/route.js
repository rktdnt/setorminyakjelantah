import mongoose from 'mongoose';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Petugas from '@/lib/models/Petugas';
import Cabang from '@/lib/models/Cabang';
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

function ensureAdmin(req) {
  const authUser = readAuthUser(req);

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  return null;
}

export async function GET(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    await dbConnect();

    const petugas = await Petugas.find()
      .populate('user_id', 'nama email')
      .populate('cabang_id', 'nama_cabang')
      .sort({ _id: -1 });

    return NextResponse.json({
      success: true,
      data: petugas.map((item) => ({
        petugas_id: item._id.toString(),
        user_id: item.user_id?._id?.toString() || '',
        nama: item.user_id?.nama || '-',
        email: item.user_id?.email || '-',
        cabang_id: item.cabang_id?._id?.toString() || null,
        cabang_nama: item.cabang_id?.nama_cabang || '-',
        jabatan: item.jabatan,
        status_petugas: item.status_petugas,
      })),
    });
  } catch (error) {
    console.error('Get petugas error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data petugas.' }, { status: 500 });
  }
}

export async function POST(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    await dbConnect();

    const { nama, email, password, jabatan = null, cabang_id } = await req.json();

    if (!nama || !email || !password || !cabang_id) {
      return NextResponse.json(
        { success: false, message: 'Nama, email, password, dan cabang petugas wajib diisi.' },
        { status: 400 }
      );
    }

    const cabang = await Cabang.findOne({ _id: cabang_id, aktif: true }).select('_id nama_cabang');

    if (!cabang) {
      return NextResponse.json({ success: false, message: 'Cabang tidak valid atau nonaktif.' }, { status: 400 });
    }

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const session = await mongoose.startSession();
    let created;

    try {
      session.startTransaction();

      const [user] = await User.create([{
        cabang_id: cabang._id,
        nama,
        email,
        password: hashedPassword,
        status_akun: 'petugas',
      }], { session });

      const [petugas] = await Petugas.create([{
        user_id: user._id,
        cabang_id: cabang._id,
        jabatan,
        status_petugas: 'aktif',
      }], { session });

      await session.commitTransaction();

      created = {
        petugas_id: petugas._id.toString(),
        user_id: user._id.toString(),
        nama: user.nama,
        email: user.email,
        cabang_id: cabang._id.toString(),
        cabang_nama: cabang.nama_cabang || '-',
        jabatan: petugas.jabatan,
        status_petugas: petugas.status_petugas,
      };
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ success: false, message: 'Email sudah digunakan.' }, { status: 409 });
    }

    console.error('Create petugas error:', error);
    return NextResponse.json({ success: false, message: 'Gagal menambahkan petugas.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    await dbConnect();

    const { petugas_id, status_petugas } = await req.json();
    const normalizedStatus = String(status_petugas || '').toLowerCase();

    if (!petugas_id || !['aktif', 'nonaktif'].includes(normalizedStatus)) {
      return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const session = await mongoose.startSession();
    let updated;

    try {
      session.startTransaction();

      const petugas = await Petugas.findByIdAndUpdate(
        petugas_id,
        { status_petugas: normalizedStatus },
        { new: true, session }
      );

      if (!petugas) {
        throw new Error('PETUGAS_NOT_FOUND');
      }

      const user = await User.findByIdAndUpdate(
        petugas.user_id,
        { status_akun: normalizedStatus === 'aktif' ? 'petugas' : 'nonaktif' },
        { new: true, session }
      );

      await session.commitTransaction();

      updated = {
        petugas_id: petugas._id.toString(),
        user_id: user._id.toString(),
        nama: user.nama,
        email: user.email,
        cabang_id: petugas.cabang_id?.toString() || null,
        cabang_nama: '-',
        jabatan: petugas.jabatan,
        status_petugas: petugas.status_petugas,
      };
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update petugas status error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengubah status petugas.' }, { status: 500 });
  }
}
