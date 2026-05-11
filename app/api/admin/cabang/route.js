import { prisma } from '@/lib/prisma';
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
    const data = await prisma.cabang.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: data.map((item) => ({
        cabang_id: Number(item.cabang_id),
        kode_cabang: item.kode_cabang,
        nama_cabang: item.nama_cabang,
        alamat: item.alamat,
        aktif: item.aktif,
      })),
    });
  } catch (error) {
    console.error('Get cabang error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data cabang.' }, { status: 500 });
  }
}

export async function POST(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    const { kode_cabang, nama_cabang, alamat = '' } = await req.json();

    if (!kode_cabang || !nama_cabang) {
      return NextResponse.json(
        { success: false, message: 'Kode cabang dan nama cabang wajib diisi.' },
        { status: 400 }
      );
    }

    const created = await prisma.cabang.create({
      data: {
        kode_cabang: String(kode_cabang).trim().toUpperCase(),
        nama_cabang: String(nama_cabang).trim(),
        alamat: String(alamat || '').trim() || null,
        aktif: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        cabang_id: Number(created.cabang_id),
        kode_cabang: created.kode_cabang,
        nama_cabang: created.nama_cabang,
        alamat: created.alamat,
        aktif: created.aktif,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, message: 'Kode cabang sudah digunakan.' }, { status: 409 });
    }

    console.error('Create cabang error:', error);
    return NextResponse.json({ success: false, message: 'Gagal menambahkan cabang.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const forbidden = ensureAdmin(req);

  if (forbidden) {
    return forbidden;
  }

  try {
    const { cabang_id, aktif } = await req.json();

    if (!cabang_id || typeof aktif !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const updated = await prisma.cabang.update({
      where: { cabang_id: BigInt(cabang_id) },
      data: { aktif },
    });

    return NextResponse.json({
      success: true,
      data: {
        cabang_id: Number(updated.cabang_id),
        kode_cabang: updated.kode_cabang,
        nama_cabang: updated.nama_cabang,
        alamat: updated.alamat,
        aktif: updated.aktif,
      },
    });
  } catch (error) {
    console.error('Update cabang status error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengubah status cabang.' }, { status: 500 });
  }
}
