# Setor Minyak Jelantah

Aplikasi web Next.js untuk login user, setor minyak, verifikasi admin, dan update poin otomatis.

## 1) Jalankan aplikasi

```bash
npm install
npm run dev
```

Aplikasi akan jalan di http://localhost:3000.

## 2) Rombak database agar sesuai web

Gunakan file migrasi ini:

- [database/db_minyak_migration.sql](database/db_minyak_migration.sql)

Cara pakai (contoh MySQL CLI):

```bash
mysql -u root -p < database/db_minyak_migration.sql
```

File migrasi akan:

1. Membuat database `db_minyak` jika belum ada.
2. Menyusun ulang tabel inti menjadi `users`, `petugas`, `cabang`, `setoran_minyak`, `reward_rule`, `saldo_poin`, `hadiah`, `penukaran_reward`, `reward_transaksi`, `mutasi_point`.
3. Menyesuaikan tabel `setoran_minyak` agar punya kolom status verifikasi, poin setoran, timestamp, dan index.
4. Normalisasi nilai status verifikasi ke: `pending`, `approved`, `rejected`.
5. Seed akun petugas awal:
   - email: `admin@setorminyak.local`
   - password: `admin123`

## 3) Catatan flow aplikasi

1. Buka web langsung ke login.
2. Login selalu masuk ke user page (`/dashboard`).
3. Hanya akun petugas/admin yang bisa membuka `/admin`.
4. Saat setoran diverifikasi `approved`, poin user otomatis bertambah.
5. User bisa menukar poin di halaman `/hadiah`.
6. Penukaran hadiah otomatis mencatat transaksi ke `penukaran_reward`, `reward_transaksi`, `mutasi_point`, dan update `saldo_poin`.

## 4) Struktur API penting

- [app/api/login/route.js](app/api/login/route.js)
- [app/api/setor/route.js](app/api/setor/route.js)
- [app/api/admin/dashboard/route.js](app/api/admin/dashboard/route.js)
- [app/api/admin/setoran/route.js](app/api/admin/setoran/route.js)
- [app/api/user/summary/route.js](app/api/user/summary/route.js)
- [app/api/user/hadiah/route.js](app/api/user/hadiah/route.js)
- [app/api/user/penukaran/route.js](app/api/user/penukaran/route.js)
- [app/api/logout/route.js](app/api/logout/route.js)
