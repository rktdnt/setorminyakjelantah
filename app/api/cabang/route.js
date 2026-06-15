import dbConnect from '@/lib/mongodb';
import Cabang from '@/lib/models/Cabang';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await dbConnect();

    const cabang = await Cabang.find({ aktif: true })
      .sort({ nama_cabang: 1 })
      .select('kode_cabang nama_cabang');

    return NextResponse.json({
      success: true,
      data: cabang.map((item) => ({
        cabang_id: item._id.toString(),
        kode_cabang: item.kode_cabang,
        nama_cabang: item.nama_cabang,
      })),
    });
  } catch (error) {
    console.error('Get cabang public error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data cabang.' }, { status: 500 });
  }
}
