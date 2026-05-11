import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cabang = await prisma.cabang.findMany({
      where: { aktif: true },
      orderBy: { nama_cabang: 'asc' },
      select: {
        cabang_id: true,
        kode_cabang: true,
        nama_cabang: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: cabang.map((item) => ({
        cabang_id: Number(item.cabang_id),
        kode_cabang: item.kode_cabang,
        nama_cabang: item.nama_cabang,
      })),
    });
  } catch (error) {
    console.error('Get cabang public error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data cabang.' }, { status: 500 });
  }
}
