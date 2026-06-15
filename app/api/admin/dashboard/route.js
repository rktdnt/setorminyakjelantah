import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Cabang from '@/lib/models/Cabang';
import SetoranMinyak from '@/lib/models/SetoranMinyak';
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

  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Akses admin ditolak.' }, { status: 403 });
  }

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10));
    const skip = (page - 1) * limit;

    const adminProfile = await User.findById(authUser.user_id)
      .select('cabang_id')
      .populate('cabang_id', 'nama_cabang alamat');

    const totalUsers = await User.countDocuments();

    const pendingSetoran = await SetoranMinyak.countDocuments({ status_verifikasi: 'pending' });

    const totalLiterResult = await SetoranMinyak.aggregate([
      { $group: { _id: null, total: { $sum: '$jumlah_liter' } } },
    ]);

    const totalSetoran = await SetoranMinyak.countDocuments();

    const recentSetoran = await SetoranMinyak.find()
      .select('user_id tanggal_setor jumlah_liter status_verifikasi')
      .populate('user_id', 'nama')
      .sort({ tanggal_setor: -1 })
      .skip(skip)
      .limit(limit);

    const totalLiter = totalLiterResult[0]?.total || 0;
    const cabang = adminProfile?.cabang_id; // populated

    return NextResponse.json({
      success: true,
      canModerate: authUser.role === 'admin',
      admin: {
        cabangLabel: cabang
          ? `${cabang.nama_cabang}${cabang.alamat ? ` - ${cabang.alamat}` : ''}`
          : 'Cabang belum ditentukan',
      },
      summary: {
        totalUsers,
        pendingSetoran,
        totalLiter: parseFloat(totalLiter.toString()),
      },
      recent: recentSetoran.map(item => ({
        setoran_id: item._id.toString(),
        user_id: item.user_id?._id?.toString() || '',
        nama: item.user_id?.nama || '-',
        tanggal_setor: item.tanggal_setor,
        jumlah_liter: parseFloat(item.jumlah_liter.toString()),
        status_verifikasi: item.status_verifikasi,
      })),
      pagination: {
        page,
        limit,
        totalItems: totalSetoran,
        totalPages: Math.ceil(totalSetoran / limit),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data dashboard admin.',
      },
      { status: 500 }
    );
  }
}
