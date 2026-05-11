import crypto from 'crypto';
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
    const petugas = await prisma.petugas.findMany({
      include: {
        user: {
          select: {
            user_id: true,
            nama: true,
            email: true,
          },
        },
        cabang: {
          select: {
            nama_cabang: true,
          },
        },
      },
      orderBy: { petugas_id: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: petugas.map((item) => ({
        petugas_id: Number(item.petugas_id),
        user_id: Number(item.user_id),
        nama: item.user?.nama || '-',
        email: item.user?.email || '-',
        cabang_id: item.cabang_id ? Number(item.cabang_id) : null,
        cabang_nama: item.cabang?.nama_cabang || '-',
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
    const { nama, email, password, jabatan = null, cabang_id } = await req.json();
    const parsedCabangId = Number(cabang_id);

    if (!nama || !email || !password || !parsedCabangId) {
      return NextResponse.json(
        { success: false, message: 'Nama, email, password, dan cabang petugas wajib diisi.' },
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

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          cabang_id: BigInt(parsedCabangId),
          nama,
          email,
          password: hashedPassword,
          status_akun: 'petugas',
        },
      });

      const petugas = await tx.petugas.create({
        data: {
          user_id: user.user_id,
          cabang_id: BigInt(parsedCabangId),
          jabatan,
          status_petugas: 'aktif',
        },
        include: {
          cabang: {
            select: {
              nama_cabang: true,
            },
          },
        },
      });

      return {
        petugas_id: Number(petugas.petugas_id),
        user_id: Number(user.user_id),
        nama: user.nama,
        email: user.email,
        cabang_id: parsedCabangId,
        cabang_nama: petugas.cabang?.nama_cabang || '-',
        jabatan: petugas.jabatan,
        status_petugas: petugas.status_petugas,
      };
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 'P2002') {
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
    const { petugas_id, status_petugas } = await req.json();
    const normalizedStatus = String(status_petugas || '').toLowerCase();

    if (!petugas_id || !['aktif', 'nonaktif'].includes(normalizedStatus)) {
      return NextResponse.json({ success: false, message: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const petugas = await tx.petugas.update({
        where: { petugas_id: BigInt(petugas_id) },
        data: { status_petugas: normalizedStatus },
      });

      const user = await tx.user.update({
        where: { user_id: petugas.user_id },
        data: { status_akun: normalizedStatus === 'aktif' ? 'petugas' : 'nonaktif' },
      });

      return {
        petugas_id: Number(petugas.petugas_id),
        user_id: Number(user.user_id),
        nama: user.nama,
        email: user.email,
        cabang_id: petugas.cabang_id ? Number(petugas.cabang_id) : null,
        cabang_nama: '-',
        jabatan: petugas.jabatan,
        status_petugas: petugas.status_petugas,
      };
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update petugas status error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengubah status petugas.' }, { status: 500 });
  }
}
