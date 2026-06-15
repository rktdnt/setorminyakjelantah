import dbConnect from '@/lib/mongodb';
import SetoranMinyak from '@/lib/models/SetoranMinyak';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    await dbConnect();
    const { user_id, liter, foto_bukti } = await req.json();

    await SetoranMinyak.create({
      user_id,
      tanggal_setor: new Date(),
      jumlah_liter: liter,
      foto_bukti: foto_bukti || null,
      status_verifikasi: 'pending',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setor error:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat setoran.' }, { status: 500 });
  }
}