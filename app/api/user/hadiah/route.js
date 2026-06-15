import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Hadiah from '@/lib/models/Hadiah';
import SaldoPoin from '@/lib/models/SaldoPoin';
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

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();

    const user = await User.findById(authUser.user_id).select('poin');
    const saldoPoin = await SaldoPoin.findOne({ user_id: authUser.user_id }).select('total_poin');

    const hadiahs = await Hadiah.find({ status_hadiah: 'aktif' })
      .select('nama_hadiah deskripsi foto_contoh poin_dibutuhkan stok status_hadiah')
      .sort({ poin_dibutuhkan: 1, _id: 1 });

    const userPoin = saldoPoin?.total_poin || user?.poin || 0;

    return NextResponse.json({
      success: true,
      poin: userPoin,
      hadiah: hadiahs.map(h => ({
        hadiah_id: h._id.toString(),
        nama_hadiah: h.nama_hadiah,
        deskripsi: h.deskripsi,
        foto_contoh: h.foto_contoh,
        poin_dibutuhkan: h.poin_dibutuhkan,
        stok: h.stok,
        status_hadiah: h.status_hadiah,
      })),
    });
  } catch (error) {
    console.error('Hadiah error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data hadiah.' }, { status: 500 });
  }
}
