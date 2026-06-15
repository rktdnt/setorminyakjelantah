import dbConnect from '@/lib/mongodb';
import Hadiah from '@/lib/models/Hadiah';
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

    const hadiah = await Hadiah.find().sort({ _id: -1 });

    return NextResponse.json({
      success: true,
      data: hadiah.map((item) => ({
        hadiah_id: item._id.toString(),
        nama_hadiah: item.nama_hadiah,
        deskripsi: item.deskripsi,
        poin_dibutuhkan: item.poin_dibutuhkan,
        stok: item.stok,
        foto_contoh: item.foto_contoh,
        status_hadiah: item.status_hadiah,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data hadiah.' }, { status: 500 });
  }
}

export async function POST(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    await dbConnect();

    const { nama_hadiah, poin_dibutuhkan, stok = 0, deskripsi = '', foto_contoh = null } = await req.json();

    if (!nama_hadiah || !poin_dibutuhkan) {
      return NextResponse.json(
        { success: false, message: 'Nama hadiah dan poin dibutuhkan wajib diisi.' },
        { status: 400 }
      );
    }

    const created = await Hadiah.create({
      nama_hadiah,
      poin_dibutuhkan: Number(poin_dibutuhkan),
      stok: Number(stok),
      deskripsi,
      foto_contoh: foto_contoh || null,
      status_hadiah: 'aktif',
    });

    return NextResponse.json({
      success: true,
      data: {
        hadiah_id: created._id.toString(),
        nama_hadiah: created.nama_hadiah,
        deskripsi: created.deskripsi,
        poin_dibutuhkan: created.poin_dibutuhkan,
        stok: created.stok,
        foto_contoh: created.foto_contoh,
        status_hadiah: created.status_hadiah,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    });
  } catch (error) {
    console.error('Create hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal menambahkan hadiah.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    await dbConnect();

    const { hadiah_id, status_hadiah } = await req.json();
    const normalizedStatus = String(status_hadiah || '').toLowerCase();

    if (!hadiah_id || !['aktif', 'nonaktif'].includes(normalizedStatus)) {
      return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const updated = await Hadiah.findByIdAndUpdate(
      hadiah_id,
      { status_hadiah: normalizedStatus },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Hadiah tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        hadiah_id: updated._id.toString(),
        nama_hadiah: updated.nama_hadiah,
        deskripsi: updated.deskripsi,
        poin_dibutuhkan: updated.poin_dibutuhkan,
        stok: updated.stok,
        foto_contoh: updated.foto_contoh,
        status_hadiah: updated.status_hadiah,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (error) {
    console.error('Update hadiah status error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengubah status hadiah.' }, { status: 500 });
  }
}
