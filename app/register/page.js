'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RegisterPage() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');

  const handleRegister = async () => {
    setStatus('');
    setStatusType('');

    if (!nama || !email || !password) {
      setStatus('Nama, email, dan password wajib diisi.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nama, email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setStatus(data.message || 'Gagal membuat user baru.');
        setStatusType('error');
        return;
      }

      setStatus('User berhasil dibuat. Silakan login.');
      setStatusType('success');
      setNama('');
      setEmail('');
      setPassword('');
      window.location.href = '/login';
    } catch {
      setStatus('Terjadi masalah jaringan. Coba lagi.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="m3-page">
      <section className="m3-hero">
        <h1 className="m3-headline">Create User</h1>
        <p className="m3-subtitle">Buat akun baru untuk user sebelum login ke aplikasi.</p>
      </section>

      <section className="m3-card m3-stack">
        <label className="m3-stack">
          <span className="m3-label">Nama</span>
          <input className="m3-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama user" />
        </label>

        <label className="m3-stack">
          <span className="m3-label">Email</span>
          <input className="m3-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
        </label>

        <label className="m3-stack">
          <span className="m3-label">Password</span>
          <input
            className="m3-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </label>

        {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

        <div className="m3-row">
          <button className="m3-button" onClick={handleRegister} disabled={isLoading}>
            {isLoading ? 'Menyimpan...' : 'Create User'}
          </button>
          <Link className="m3-link secondary" href="/login">Kembali ke Login</Link>
        </div>
      </section>
    </main>
  );
}
