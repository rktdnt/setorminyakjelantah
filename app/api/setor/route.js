import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { user_id, liter } = await req.json();

  await db.execute(
    "INSERT INTO setoran_minyak (user_id, tanggal_setor, jumlah_liter, status_verifikasi) VALUES (?,NOW(),?,'pending')",
    [user_id, liter]
  );

  return NextResponse.json({ success: true });
}