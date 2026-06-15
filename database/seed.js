import mongoose from 'mongoose';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/setorminyakjelantah';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Import models after connection
  const { default: Cabang } = await import('../lib/models/Cabang.js');
  const { default: User } = await import('../lib/models/User.js');
  const { default: Petugas } = await import('../lib/models/Petugas.js');
  const { default: RewardRule } = await import('../lib/models/RewardRule.js');
  const { default: SaldoPoin } = await import('../lib/models/SaldoPoin.js');

  // 1. Default RewardRule
  const existingRule = await RewardRule.findOne({ nama_rule: 'Default Rule' });
  if (!existingRule) {
    await RewardRule.create({
      nama_rule: 'Default Rule',
      minimal_liter: 0,
      poin_per_liter: 10,
      bonus_poin: 0,
      aktif: true,
    });
    console.log('Created default RewardRule.');
  } else {
    console.log('Default RewardRule already exists.');
  }

  // 2. Default Cabang
  let cabang = await Cabang.findOne({ kode_cabang: 'CBG-UTAMA' });
  if (!cabang) {
    cabang = await Cabang.create({
      kode_cabang: 'CBG-UTAMA',
      nama_cabang: 'Cabang Utama',
      alamat: 'Belum diatur',
    });
    console.log('Created default Cabang.');
  } else {
    console.log('Default Cabang already exists.');
  }

  // 3. Default admin user
  let adminUser = await User.findOne({ email: 'admin@setorminyak.local' });
  if (!adminUser) {
    const hashedPassword = crypto.createHash('md5').update('admin123').digest('hex');
    adminUser = await User.create({
      cabang_id: cabang._id,
      nama: 'Petugas Admin',
      email: 'admin@setorminyak.local',
      password: hashedPassword,
      status_akun: 'petugas',
      poin: 0,
    });
    console.log('Created default admin User.');
  } else {
    console.log('Default admin User already exists.');
  }

  // 4. Default Petugas
  const existingPetugas = await Petugas.findOne({ user_id: adminUser._id });
  if (!existingPetugas) {
    await Petugas.create({
      user_id: adminUser._id,
      cabang_id: cabang._id,
      jabatan: 'Petugas Lapangan',
      status_petugas: 'aktif',
    });
    console.log('Created default Petugas.');
  } else {
    console.log('Default Petugas already exists.');
  }

  // 5. Default SaldoPoin
  const existingSaldo = await SaldoPoin.findOne({ user_id: adminUser._id });
  if (!existingSaldo) {
    await SaldoPoin.create({
      user_id: adminUser._id,
      total_poin: 0,
    });
    console.log('Created default SaldoPoin.');
  } else {
    console.log('Default SaldoPoin already exists.');
  }

  console.log('Seed completed.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
