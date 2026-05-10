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

Cara pakai di Supabase SQL Editor:

1. Buka project Supabase.
2. Buka SQL Editor.
3. Jalankan file migrasi tersebut.

Lalu set environment variable aplikasi ke connection string Postgres Supabase, misalnya `SUPABASE_DB_URL` atau `DATABASE_URL`.

File migrasi akan:

1. Menyusun ulang tabel inti menjadi `users`, `petugas`, `cabang`, `setoran_minyak`, `reward_rule`, `saldo_poin`, `hadiah`, `penukaran_reward`, `reward_transaksi`, `mutasi_point`.
2. Menyesuaikan tabel `setoran_minyak` agar punya kolom status verifikasi, poin setoran, timestamp, dan index.
3. Menyediakan trigger `updated_at` untuk tabel yang membutuhkannya.
4. Seed akun petugas awal:
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
