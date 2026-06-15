import mongoose from 'mongoose';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/setorminyakjelantah';

function hashPassword(pw) {
  return crypto.createHash('md5').update(pw).digest('hex');
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const { default: Cabang } = await import('../lib/models/Cabang.js');
  const { default: User } = await import('../lib/models/User.js');
  const { default: Petugas } = await import('../lib/models/Petugas.js');
  const { default: RewardRule } = await import('../lib/models/RewardRule.js');
  const { default: SaldoPoin } = await import('../lib/models/SaldoPoin.js');
  const { default: Hadiah } = await import('../lib/models/Hadiah.js');
  const { default: SetoranMinyak } = await import('../lib/models/SetoranMinyak.js');
  const { default: PenukaranReward } = await import('../lib/models/PenukaranReward.js');
  const { default: RewardTransaksi } = await import('../lib/models/RewardTransaksi.js');
  const { default: MutasiPoint } = await import('../lib/models/MutasiPoint.js');

  // Clear all collections
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    Cabang.deleteMany({}),
    User.deleteMany({}),
    Petugas.deleteMany({}),
    RewardRule.deleteMany({}),
    SaldoPoin.deleteMany({}),
    Hadiah.deleteMany({}),
    SetoranMinyak.deleteMany({}),
    PenukaranReward.deleteMany({}),
    RewardTransaksi.deleteMany({}),
    MutasiPoint.deleteMany({}),
  ]);
  console.log('   Done.\n');

  // ═══════════════════════════════════════════
  // 1. REWARD RULES
  // ═══════════════════════════════════════════
  console.log('📋 Creating Reward Rules...');
  const rules = await RewardRule.insertMany([
    { nama_rule: 'Default Rule', minimal_liter: 0, poin_per_liter: 10, bonus_poin: 0, aktif: true },
    { nama_rule: 'Bonus 5L+', minimal_liter: 5, poin_per_liter: 10, bonus_poin: 20, aktif: true },
    { nama_rule: 'Bonus 10L+', minimal_liter: 10, poin_per_liter: 12, bonus_poin: 50, aktif: true },
    { nama_rule: 'Promo Spesial 20L+', minimal_liter: 20, poin_per_liter: 15, bonus_poin: 100, aktif: true },
  ]);
  console.log(`   ${rules.length} rules created.\n`);

  // ═══════════════════════════════════════════
  // 2. CABANG
  // ═══════════════════════════════════════════
  console.log('🏢 Creating Cabang...');
  const cabangData = [
    { kode_cabang: 'CBG-UTAMA', nama_cabang: 'Cabang Utama', alamat: 'Jl. Merdeka No. 1, Jakarta Pusat' },
    { kode_cabang: 'CBG-JKT-S', nama_cabang: 'Cabang Jakarta Selatan', alamat: 'Jl. Sudirman No. 45, Kebayoran Baru' },
    { kode_cabang: 'CBG-BDG', nama_cabang: 'Cabang Bandung', alamat: 'Jl. Braga No. 12, Bandung' },
    { kode_cabang: 'CBG-SBY', nama_cabang: 'Cabang Surabaya', alamat: 'Jl. Tunjungan No. 88, Surabaya' },
    { kode_cabang: 'CBG-YGY', nama_cabang: 'Cabang Yogyakarta', alamat: 'Jl. Malioboro No. 55, Yogyakarta' },
  ];
  const cabangList = await Cabang.insertMany(cabangData);
  console.log(`   ${cabangList.length} cabang created.\n`);

  // ═══════════════════════════════════════════
  // 3. ADMIN & PETUGAS USERS
  // ═══════════════════════════════════════════
  console.log('👤 Creating Admin & Petugas...');

  // Admin user
  const adminUser = await User.create({
    cabang_id: cabangList[0]._id,
    nama: 'Admin Utama',
    email: 'admin@setorminyak.local',
    password: hashPassword('admin123'),
    status_akun: 'admin',
    poin: 0,
    tanggal_daftar: new Date('2025-01-01'),
  });

  // Petugas users
  const petugasUsers = [];
  const petugasData = [
    { nama: 'Budi Santoso', email: 'budi@setorminyak.local', cabangIdx: 0, jabatan: 'Petugas Lapangan' },
    { nama: 'Siti Rahayu', email: 'siti@setorminyak.local', cabangIdx: 1, jabatan: 'Petugas Verifikasi' },
    { nama: 'Ahmad Fauzi', email: 'ahmad@setorminyak.local', cabangIdx: 2, jabatan: 'Petugas Lapangan' },
    { nama: 'Dewi Lestari', email: 'dewi@setorminyak.local', cabangIdx: 3, jabatan: 'Koordinator Lapangan' },
    { nama: 'Eko Prasetyo', email: 'eko@setorminyak.local', cabangIdx: 4, jabatan: 'Petugas Lapangan' },
  ];

  for (const p of petugasData) {
    const user = await User.create({
      cabang_id: cabangList[p.cabangIdx]._id,
      nama: p.nama,
      email: p.email,
      password: hashPassword('petugas123'),
      status_akun: 'petugas',
      poin: 0,
      tanggal_daftar: randomDate(new Date('2025-01-01'), new Date('2025-03-01')),
    });
    await Petugas.create({
      user_id: user._id,
      cabang_id: cabangList[p.cabangIdx]._id,
      jabatan: p.jabatan,
      status_petugas: 'aktif',
    });
    petugasUsers.push(user);
  }

  // Admin petugas record
  await Petugas.create({
    user_id: adminUser._id,
    cabang_id: cabangList[0]._id,
    jabatan: 'Administrator',
    status_petugas: 'aktif',
  });

  console.log(`   1 admin + ${petugasUsers.length} petugas created.\n`);

  // ═══════════════════════════════════════════
  // 4. REGULAR USERS (WARGA)
  // ═══════════════════════════════════════════
  console.log('👥 Creating Regular Users...');
  const wargaData = [
    { nama: 'Rina Wati', email: 'rina@gmail.com', cabangIdx: 0 },
    { nama: 'Joko Widodo', email: 'joko@gmail.com', cabangIdx: 0 },
    { nama: 'Maya Sari', email: 'maya@gmail.com', cabangIdx: 1 },
    { nama: 'Agus Setiawan', email: 'agus@gmail.com', cabangIdx: 1 },
    { nama: 'Putri Handayani', email: 'putri@gmail.com', cabangIdx: 2 },
    { nama: 'Hendra Gunawan', email: 'hendra@gmail.com', cabangIdx: 2 },
    { nama: 'Lilis Suryani', email: 'lilis@gmail.com', cabangIdx: 3 },
    { nama: 'Bambang Pamungkas', email: 'bambang@gmail.com', cabangIdx: 3 },
    { nama: 'Nurul Hidayah', email: 'nurul@gmail.com', cabangIdx: 4 },
    { nama: 'Dian Permata', email: 'dian@gmail.com', cabangIdx: 4 },
    { nama: 'Fajar Ramadhan', email: 'fajar@gmail.com', cabangIdx: 0 },
    { nama: 'Indah Kusuma', email: 'indah@gmail.com', cabangIdx: 1 },
    { nama: 'Rudi Hartono', email: 'rudi@gmail.com', cabangIdx: 2 },
    { nama: 'Sri Mulyani', email: 'sri@gmail.com', cabangIdx: 3 },
    { nama: 'Tono Sucipto', email: 'tono@gmail.com', cabangIdx: 4 },
  ];

  const wargaUsers = [];
  for (const w of wargaData) {
    const user = await User.create({
      cabang_id: cabangList[w.cabangIdx]._id,
      nama: w.nama,
      email: w.email,
      password: hashPassword('user123'),
      status_akun: 'aktif',
      poin: 0,
      tanggal_daftar: randomDate(new Date('2025-02-01'), new Date('2025-06-01')),
    });
    wargaUsers.push(user);
  }
  console.log(`   ${wargaUsers.length} users created.\n`);

  // ═══════════════════════════════════════════
  // 5. HADIAH (PRIZES)
  // ═══════════════════════════════════════════
  console.log('🎁 Creating Hadiah...');
  const hadiahList = await Hadiah.insertMany([
    { nama_hadiah: 'Sabun Cuci Piring 500ml', deskripsi: 'Sabun cuci piring merek terkenal, ukuran 500ml', poin_dibutuhkan: 50, stok: 100, status_hadiah: 'aktif' },
    { nama_hadiah: 'Minyak Goreng 1 Liter', deskripsi: 'Minyak goreng premium kemasan 1 liter', poin_dibutuhkan: 100, stok: 50, status_hadiah: 'aktif' },
    { nama_hadiah: 'Beras 5 Kg', deskripsi: 'Beras premium kualitas terbaik 5 kilogram', poin_dibutuhkan: 200, stok: 30, status_hadiah: 'aktif' },
    { nama_hadiah: 'Voucher Belanja Rp 50.000', deskripsi: 'Voucher belanja di minimarket terdekat', poin_dibutuhkan: 300, stok: 20, status_hadiah: 'aktif' },
    { nama_hadiah: 'Kompor Gas Portable', deskripsi: 'Kompor gas portable untuk kebutuhan sehari-hari', poin_dibutuhkan: 500, stok: 10, status_hadiah: 'aktif' },
    { nama_hadiah: 'Set Peralatan Masak', deskripsi: 'Set peralatan masak anti lengket isi 5 pcs', poin_dibutuhkan: 800, stok: 5, status_hadiah: 'aktif' },
    { nama_hadiah: 'Blender Elektrik', deskripsi: 'Blender elektrik multifungsi untuk dapur', poin_dibutuhkan: 1000, stok: 3, status_hadiah: 'aktif' },
    { nama_hadiah: 'Tas Belanja Ramah Lingkungan', deskripsi: 'Tas belanja reusable dari bahan daur ulang', poin_dibutuhkan: 30, stok: 200, status_hadiah: 'aktif' },
  ]);
  console.log(`   ${hadiahList.length} hadiah created.\n`);

  // ═══════════════════════════════════════════
  // 6. SETORAN MINYAK (OIL DEPOSITS)
  // ═══════════════════════════════════════════
  console.log('🛢️  Creating Setoran Minyak...');
  const allPetugas = await Petugas.find();
  const setoranRecords = [];

  for (const user of wargaUsers) {
    // Each user gets 2-6 setoran
    const numSetoran = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numSetoran; i++) {
      const liter = parseFloat((0.5 + Math.random() * 14.5).toFixed(1));
      const statusOptions = ['pending', 'approved', 'approved', 'approved', 'rejected']; // 60% approved
      const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
      const tanggalSetor = randomDate(new Date('2025-03-01'), new Date('2026-06-15'));
      const petugasRandom = allPetugas[Math.floor(Math.random() * allPetugas.length)];

      // Determine matching rule
      let matchedRule = rules[0];
      for (const rule of rules) {
        if (rule.aktif && liter >= rule.minimal_liter) {
          matchedRule = rule;
        }
      }

      const computedPoin = status === 'approved'
        ? Math.round(liter * matchedRule.poin_per_liter + matchedRule.bonus_poin)
        : 0;

      const setoran = await SetoranMinyak.create({
        user_id: user._id,
        petugas_id: petugasRandom._id,
        cabang_id: user.cabang_id,
        rule_id: status === 'approved' ? matchedRule._id : null,
        tanggal_setor: tanggalSetor,
        jumlah_liter: liter,
        poin_didapat: computedPoin,
        status_verifikasi: status,
        verified_at: status !== 'pending' ? new Date(tanggalSetor.getTime() + 3600000) : null,
        verified_by: status !== 'pending' ? petugasRandom.user_id : null,
        foto_bukti: null,
      });
      setoranRecords.push({ setoran, user, computedPoin, status, matchedRule });
    }
  }
  console.log(`   ${setoranRecords.length} setoran created.\n`);

  // ═══════════════════════════════════════════
  // 7. CALCULATE & SET USER POINTS
  // ═══════════════════════════════════════════
  console.log('💰 Calculating user points...');
  for (const user of wargaUsers) {
    const approvedSetoran = setoranRecords.filter(
      (s) => s.user._id.equals(user._id) && s.status === 'approved'
    );
    const totalPoin = approvedSetoran.reduce((sum, s) => sum + s.computedPoin, 0);

    await User.updateOne({ _id: user._id }, { poin: totalPoin });
    await SaldoPoin.create({ user_id: user._id, total_poin: totalPoin });

    // Create reward transaksi & mutasi for each approved setoran
    let runningPoin = 0;
    for (const record of approvedSetoran) {
      const poinSebelum = runningPoin;
      runningPoin += record.computedPoin;

      await RewardTransaksi.create({
        user_id: user._id,
        rule_id: record.matchedRule._id,
        setoran_id: record.setoran._id,
        jenis_reward: 'setoran',
        poin: record.computedPoin,
        deskripsi: `Reward verifikasi setoran #${record.setoran._id}`,
        created_at: record.setoran.tanggal_setor,
      });

      await MutasiPoint.create({
        user_id: user._id,
        jenis_mutasi: 'credit',
        referensi_tabel: 'setoran_minyak',
        referensi_id: record.setoran._id,
        poin: record.computedPoin,
        poin_sebelum: poinSebelum,
        poin_sesudah: runningPoin,
        keterangan: `Credit poin dari setoran #${record.setoran._id}`,
        created_at: record.setoran.tanggal_setor,
      });
    }
  }

  // Admin & petugas saldo
  await SaldoPoin.create({ user_id: adminUser._id, total_poin: 0 });
  for (const pu of petugasUsers) {
    await SaldoPoin.create({ user_id: pu._id, total_poin: 0 });
  }
  console.log('   Done.\n');

  // ═══════════════════════════════════════════
  // 8. PENUKARAN REWARD (REDEMPTIONS)
  // ═══════════════════════════════════════════
  console.log('🎉 Creating Penukaran Reward...');
  let penukaranCount = 0;

  // Give some users redemptions (users with enough points)
  for (const user of wargaUsers) {
    const freshUser = await User.findById(user._id);
    let currentPoin = freshUser.poin;

    if (currentPoin < 50) continue; // Skip users with low points

    // 1-2 redemptions per eligible user
    const numPenukaran = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numPenukaran; i++) {
      // Pick affordable hadiah
      const affordable = hadiahList.filter((h) => h.poin_dibutuhkan <= currentPoin);
      if (affordable.length === 0) break;

      const hadiah = affordable[Math.floor(Math.random() * affordable.length)];
      const poinDipakai = hadiah.poin_dibutuhkan;
      const poinSebelum = currentPoin;
      currentPoin -= poinDipakai;

      const statusOpts = ['done', 'done', 'done', 'pending'];
      const statusPenukaran = statusOpts[Math.floor(Math.random() * statusOpts.length)];
      const requestedAt = randomDate(new Date('2025-06-01'), new Date('2026-06-15'));

      const penukaran = await PenukaranReward.create({
        user_id: user._id,
        hadiah_id: hadiah._id,
        jumlah: 1,
        total_poin_dipakai: poinDipakai,
        status_penukaran: statusPenukaran,
        requested_at: requestedAt,
        processed_at: statusPenukaran === 'done' ? new Date(requestedAt.getTime() + 7200000) : null,
        processed_by: statusPenukaran === 'done' ? adminUser._id : null,
      });

      if (statusPenukaran === 'done') {
        await RewardTransaksi.create({
          user_id: user._id,
          jenis_reward: 'penyesuaian',
          poin: -poinDipakai,
          deskripsi: `Penukaran hadiah #${penukaran._id} - ${hadiah.nama_hadiah}`,
          created_at: requestedAt,
        });

        await MutasiPoint.create({
          user_id: user._id,
          jenis_mutasi: 'debit',
          referensi_tabel: 'penukaran_reward',
          referensi_id: penukaran._id,
          poin: -poinDipakai,
          poin_sebelum: poinSebelum,
          poin_sesudah: currentPoin,
          keterangan: `Penukaran hadiah ${hadiah.nama_hadiah}`,
          created_at: requestedAt,
        });

        // Update user points and saldo
        await User.updateOne({ _id: user._id }, { poin: currentPoin });
        await SaldoPoin.updateOne({ user_id: user._id }, { total_poin: currentPoin });

        // Decrement hadiah stock
        await Hadiah.updateOne({ _id: hadiah._id }, { $inc: { stok: -1 } });
      }

      penukaranCount++;
    }
  }
  console.log(`   ${penukaranCount} penukaran created.\n`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  const counts = {
    cabang: await Cabang.countDocuments(),
    users: await User.countDocuments(),
    petugas: await Petugas.countDocuments(),
    rewardRules: await RewardRule.countDocuments(),
    hadiah: await Hadiah.countDocuments(),
    setoran: await SetoranMinyak.countDocuments(),
    saldoPoin: await SaldoPoin.countDocuments(),
    penukaran: await PenukaranReward.countDocuments(),
    rewardTransaksi: await RewardTransaksi.countDocuments(),
    mutasiPoint: await MutasiPoint.countDocuments(),
  };

  console.log('═══════════════════════════════════════');
  console.log('  ✅ SEED COMPLETED SUCCESSFULLY');
  console.log('═══════════════════════════════════════');
  console.log(`  Cabang:            ${counts.cabang}`);
  console.log(`  Users:             ${counts.users}`);
  console.log(`  Petugas:           ${counts.petugas}`);
  console.log(`  Reward Rules:      ${counts.rewardRules}`);
  console.log(`  Hadiah:            ${counts.hadiah}`);
  console.log(`  Setoran Minyak:    ${counts.setoran}`);
  console.log(`  Saldo Poin:        ${counts.saldoPoin}`);
  console.log(`  Penukaran Reward:  ${counts.penukaran}`);
  console.log(`  Reward Transaksi:  ${counts.rewardTransaksi}`);
  console.log(`  Mutasi Point:      ${counts.mutasiPoint}`);
  console.log('═══════════════════════════════════════');
  console.log('\n📌 Login credentials:');
  console.log('   Admin:   admin@setorminyak.local / admin123');
  console.log('   Petugas: budi@setorminyak.local  / petugas123');
  console.log('   User:    rina@gmail.com          / user123');
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
