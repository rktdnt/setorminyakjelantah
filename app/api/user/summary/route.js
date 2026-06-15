import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import SetoranMinyak from '@/lib/models/SetoranMinyak';
import SaldoPoin from '@/lib/models/SaldoPoin';
import PenukaranReward from '@/lib/models/PenukaranReward';
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

const formatRelativeTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
};

export async function GET(req) {
  const authUser = readAuthUser(req);

  if (!authUser?.user_id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();

    const user = await User.findById(authUser.user_id)
      .select('nama email status_akun cabang_id poin')
      .populate('cabang_id', 'nama_cabang alamat');

    const saldoPoin = await SaldoPoin.findOne({ user_id: authUser.user_id })
      .select('total_poin');

    const recentSetoran = await SetoranMinyak.find({ user_id: authUser.user_id })
      .select('jumlah_liter status_verifikasi tanggal_setor poin_didapat')
      .sort({ tanggal_setor: -1 })
      .limit(3);

    const recentPenukaran = await PenukaranReward.find({ user_id: authUser.user_id })
      .select('total_poin_dipakai status_penukaran requested_at hadiah_id')
      .populate('hadiah_id', 'nama_hadiah')
      .sort({ requested_at: -1 })
      .limit(3);

    const pendingAgg = await SetoranMinyak.aggregate([
      { $match: { user_id: user._id, status_verifikasi: 'pending' } },
      { $group: { _id: null, total: { $sum: '$jumlah_liter' } } },
    ]);

    const approvedAgg = await SetoranMinyak.aggregate([
      { $match: { user_id: user._id, status_verifikasi: 'approved' } },
      { $group: { _id: null, total: { $sum: '$jumlah_liter' } } },
    ]);

    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
    }

    const userPoin = saldoPoin?.total_poin || user.poin || 0;
    const pendingLiter = pendingAgg[0]?.total || 0;
    const approvedLiter = approvedAgg[0]?.total || 0;

    const cabang = user.cabang_id; // populated

    const activity = [
      ...recentSetoran.map((item) => ({
        title: `Setor ${parseFloat(item.jumlah_liter).toFixed(1)} L minyak`,
        meta: `${formatRelativeTime(item.tanggal_setor)} • ${item.status_verifikasi || 'pending'}`,
        tone: item.status_verifikasi === 'approved' ? 'ok' : item.status_verifikasi === 'rejected' ? 'reject' : 'warn',
      })),
      ...recentPenukaran.map((item) => ({
        title: `Tukar hadiah ${item.hadiah_id?.nama_hadiah || '-'}`,
        meta: `${formatRelativeTime(item.requested_at)} • ${item.total_poin_dipakai} poin`,
        tone: item.status_penukaran === 'done' ? 'ok' : 'warn',
      })),
    ]
      .sort((left, right) => String(right.meta).localeCompare(String(left.meta)))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      user: {
        user_id: user._id.toString(),
        nama: user.nama,
        email: user.email,
        status_akun: user.status_akun,
        cabang_label: cabang
          ? `${cabang.nama_cabang}${cabang.alamat ? ` - ${cabang.alamat}` : ''}`
          : 'Cabang belum ditentukan',
      },
      summary: {
        poin: userPoin,
        pendingLiter,
        approvedLiter,
      },
      activity,
      pointsApplied: true,
    });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat ringkasan user.' },
      { status: 500 }
    );
  }
}
