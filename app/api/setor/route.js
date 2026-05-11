import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

async function runWithRetry(operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (error?.code !== 'P2024' || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

export async function POST(req) {
  try {
    const { user_id, liter, foto_bukti } = await req.json();

    await runWithRetry(() =>
      prisma.setoranMinyak.create({
        data: {
          user_id,
          tanggal_setor: new Date(),
          jumlah_liter: liter,
          foto_bukti: foto_bukti || null,
          status_verifikasi: 'pending',
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setor error:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat setoran.' }, { status: 500 });
  }
}