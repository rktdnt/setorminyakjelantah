-- db_minyak_migration.sql
-- Target: MySQL / MariaDB
-- Purpose: Revamp DB schema to match app + requested ERD style

CREATE DATABASE IF NOT EXISTS db_minyak;
USE db_minyak;

-- MASTER: CABANG
CREATE TABLE IF NOT EXISTS cabang (
  cabang_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode_cabang VARCHAR(30) NOT NULL,
  nama_cabang VARCHAR(120) NOT NULL,
  alamat TEXT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cabang_id),
  UNIQUE KEY uq_kode_cabang (kode_cabang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USERS (replaces legacy table user)
CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cabang_id INT UNSIGNED NULL,
  nama VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password VARCHAR(255) NOT NULL,
  status_akun ENUM('aktif', 'nonaktif', 'petugas', 'admin') NOT NULL DEFAULT 'aktif',
  poin INT UNSIGNED NOT NULL DEFAULT 0,
  tanggal_daftar DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_cabang (cabang_id),
  CONSTRAINT fk_users_cabang FOREIGN KEY (cabang_id) REFERENCES cabang(cabang_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep migration friendly if old table exists
CREATE TABLE IF NOT EXISTS `user` (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password VARCHAR(255) NOT NULL,
  status_akun ENUM('aktif', 'nonaktif', 'petugas', 'admin') NOT NULL DEFAULT 'aktif',
  poin INT UNSIGNED NOT NULL DEFAULT 0,
  tanggal_daftar DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill users from legacy user table
INSERT INTO users (user_id, nama, email, password, status_akun, poin, tanggal_daftar)
SELECT u.user_id, u.nama, u.email, u.password, COALESCE(u.status_akun, 'aktif'), COALESCE(u.poin, 0), COALESCE(u.tanggal_daftar, NOW())
FROM `user` u
LEFT JOIN users nu ON nu.user_id = u.user_id
WHERE nu.user_id IS NULL;

-- PETUGAS PROFILE
CREATE TABLE IF NOT EXISTS petugas (
  petugas_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  cabang_id INT UNSIGNED NULL,
  jabatan VARCHAR(100) NULL,
  status_petugas ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (petugas_id),
  UNIQUE KEY uq_petugas_user (user_id),
  KEY idx_petugas_cabang (cabang_id),
  CONSTRAINT fk_petugas_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_petugas_cabang FOREIGN KEY (cabang_id) REFERENCES cabang(cabang_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- REWARD RULES
CREATE TABLE IF NOT EXISTS reward_rule (
  rule_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama_rule VARCHAR(120) NOT NULL,
  minimal_liter DECIMAL(10,2) NOT NULL DEFAULT 0,
  poin_per_liter INT UNSIGNED NOT NULL DEFAULT 10,
  bonus_poin INT UNSIGNED NOT NULL DEFAULT 0,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO reward_rule (nama_rule, minimal_liter, poin_per_liter, bonus_poin, aktif)
SELECT 'Default Rule', 0, 10, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rule WHERE nama_rule = 'Default Rule');

-- SETORAN
CREATE TABLE IF NOT EXISTS setoran_minyak (
  setoran_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  petugas_id INT UNSIGNED NULL,
  cabang_id INT UNSIGNED NULL,
  rule_id INT UNSIGNED NULL,
  tanggal_setor DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  jumlah_liter DECIMAL(10,2) NOT NULL,
  poin_didapat INT UNSIGNED NOT NULL DEFAULT 0,
  status_verifikasi ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  verified_at DATETIME NULL,
  verified_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setoran_id),
  KEY idx_setoran_user (user_id),
  KEY idx_setoran_petugas (petugas_id),
  KEY idx_setoran_cabang (cabang_id),
  KEY idx_setoran_status (status_verifikasi),
  KEY idx_setoran_tanggal (tanggal_setor),
  CONSTRAINT fk_setoran_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_setoran_petugas FOREIGN KEY (petugas_id) REFERENCES petugas(petugas_id) ON DELETE SET NULL,
  CONSTRAINT fk_setoran_cabang FOREIGN KEY (cabang_id) REFERENCES cabang(cabang_id) ON DELETE SET NULL,
  CONSTRAINT fk_setoran_rule FOREIGN KEY (rule_id) REFERENCES reward_rule(rule_id) ON DELETE SET NULL,
  CONSTRAINT fk_setoran_verified_by FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE setoran_minyak
  ADD COLUMN IF NOT EXISTS petugas_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS cabang_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS rule_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS poin_didapat INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS verified_by INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- SALDO POIN SNAPSHOT
CREATE TABLE IF NOT EXISTS saldo_poin (
  saldo_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  total_poin INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (saldo_id),
  UNIQUE KEY uq_saldo_user (user_id),
  CONSTRAINT fk_saldo_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO saldo_poin (user_id, total_poin)
SELECT u.user_id, u.poin
FROM users u
LEFT JOIN saldo_poin sp ON sp.user_id = u.user_id
WHERE sp.user_id IS NULL;

UPDATE saldo_poin sp
JOIN users u ON u.user_id = sp.user_id
SET sp.total_poin = COALESCE(u.poin, 0);

-- HADIAH
CREATE TABLE IF NOT EXISTS hadiah (
  hadiah_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama_hadiah VARCHAR(140) NOT NULL,
  deskripsi TEXT NULL,
  poin_dibutuhkan INT UNSIGNED NOT NULL,
  stok INT UNSIGNED NOT NULL DEFAULT 0,
  status_hadiah ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (hadiah_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PENUKARAN REWARD
CREATE TABLE IF NOT EXISTS penukaran_reward (
  penukaran_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  hadiah_id INT UNSIGNED NOT NULL,
  jumlah INT UNSIGNED NOT NULL DEFAULT 1,
  total_poin_dipakai INT UNSIGNED NOT NULL DEFAULT 0,
  status_penukaran ENUM('pending', 'approved', 'rejected', 'done') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  processed_by INT UNSIGNED NULL,
  catatan TEXT NULL,
  PRIMARY KEY (penukaran_id),
  KEY idx_penukaran_user (user_id),
  KEY idx_penukaran_hadiah (hadiah_id),
  KEY idx_penukaran_status (status_penukaran),
  CONSTRAINT fk_penukaran_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_penukaran_hadiah FOREIGN KEY (hadiah_id) REFERENCES hadiah(hadiah_id) ON DELETE RESTRICT,
  CONSTRAINT fk_penukaran_petugas FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- REWARD TRANSAKSI
CREATE TABLE IF NOT EXISTS reward_transaksi (
  reward_transaksi_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  rule_id INT UNSIGNED NULL,
  setoran_id BIGINT UNSIGNED NULL,
  jenis_reward ENUM('setoran', 'bonus', 'penyesuaian') NOT NULL DEFAULT 'setoran',
  poin INT NOT NULL,
  deskripsi VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reward_transaksi_id),
  KEY idx_reward_user (user_id),
  KEY idx_reward_rule (rule_id),
  KEY idx_reward_setoran (setoran_id),
  CONSTRAINT fk_reward_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_reward_rule FOREIGN KEY (rule_id) REFERENCES reward_rule(rule_id) ON DELETE SET NULL,
  CONSTRAINT fk_reward_setoran FOREIGN KEY (setoran_id) REFERENCES setoran_minyak(setoran_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MUTASI POINT (ledger)
CREATE TABLE IF NOT EXISTS mutasi_point (
  mutasi_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  jenis_mutasi ENUM('credit', 'debit') NOT NULL,
  referensi_tabel VARCHAR(64) NULL,
  referensi_id BIGINT NULL,
  poin INT NOT NULL,
  poin_sebelum INT NOT NULL DEFAULT 0,
  poin_sesudah INT NOT NULL DEFAULT 0,
  keterangan VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mutasi_id),
  KEY idx_mutasi_user (user_id),
  KEY idx_mutasi_created (created_at),
  CONSTRAINT fk_mutasi_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalize status values in existing rows
UPDATE setoran_minyak
SET status_verifikasi = 'approved'
WHERE LOWER(status_verifikasi) IN ('approve', 'accepted', 'verified');

UPDATE setoran_minyak
SET status_verifikasi = 'rejected'
WHERE LOWER(status_verifikasi) IN ('reject', 'ditolak');

UPDATE setoran_minyak
SET status_verifikasi = 'pending'
WHERE LOWER(status_verifikasi) NOT IN ('pending', 'approved', 'rejected');

-- Seed cabang default
INSERT INTO cabang (kode_cabang, nama_cabang, alamat)
SELECT 'CBG-UTAMA', 'Cabang Utama', 'Belum diatur'
WHERE NOT EXISTS (SELECT 1 FROM cabang WHERE kode_cabang = 'CBG-UTAMA');

-- Seed first admin/petugas account
INSERT INTO users (nama, email, password, status_akun, poin)
SELECT 'Petugas Admin', 'admin@setorminyak.local', MD5('admin123'), 'petugas', 0
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@setorminyak.local');

INSERT INTO petugas (user_id, jabatan, status_petugas)
SELECT u.user_id, 'Petugas Lapangan', 'aktif'
FROM users u
LEFT JOIN petugas p ON p.user_id = u.user_id
WHERE u.email = 'admin@setorminyak.local'
  AND p.petugas_id IS NULL;
