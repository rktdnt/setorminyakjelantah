import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { user_id, liter } = await req.json();

    await prisma.setoranMinyak.create({
      data: {
        user_id,
        tanggal_setor: new Date(),
        jumlah_liter: liter,
        status_verifikasi: 'pending',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setor error:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat setoran.' }, { status: 500 });
  }
}