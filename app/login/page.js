'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuthCache, saveAuthCache } from '@/lib/auth-cache';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');

  useEffect(() => {
    const cachedUser = getAuthCache();

    if (cachedUser) {
      window.location.href = '/dashboard';
    }
  }, []);

  const handleLogin = async () => {
    setStatus('');
    setStatusType('');

    if (!email || !password) {
      setStatus('Email dan password wajib diisi.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        saveAuthCache(data.user);
        setStatus('Login berhasil, mengalihkan ke dashboard...');
        setStatusType('success');
        window.location.href = '/dashboard';
        return;
      }

      setStatus('Login gagal. Periksa email atau password.');
      setStatusType('error');
    } catch {
      setStatus('Terjadi masalah jaringan. Coba beberapa saat lagi.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="m3-page">
      <section className="m3-hero">
        <h1 className="m3-headline">Masuk ke Akun</h1>
        <p className="m3-subtitle">Gunakan akun terdaftar untuk mulai setor minyak jelantah.</p>
      </section>

      <section className="m3-card m3-stack">
        <label className="m3-stack">
          <span className="m3-label">Email</span>
          <input
            className="m3-input"
            placeholder="nama@email.com"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />
        </label>

        <label className="m3-stack">
          <span className="m3-label">Password</span>
          <input
            className="m3-input"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </label>

        {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

        <div className="m3-row">
          <button className="m3-button" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? 'Memproses...' : 'Login'}
          </button>
          <Link className="m3-link secondary" href="/register">Create User</Link>
          <Link className="m3-link secondary" href="/dashboard">Lihat Dashboard</Link>
        </div>
      </section>
    </main>
  );
}