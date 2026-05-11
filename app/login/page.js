'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuthCache, saveAuthCache } from '@/lib/auth-cache';
import { FiEye, FiEyeOff, FiLogIn, FiMail, FiUserPlus } from 'react-icons/fi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotPassword || !forgotPasswordConfirm) {
      setStatus('Email, password baru, dan konfirmasi password wajib diisi.');
      setStatusType('error');
      return;
    }

    if (forgotPassword.length < 6) {
      setStatus('Password baru minimal 6 karakter.');
      setStatusType('error');
      return;
    }

    if (forgotPassword !== forgotPasswordConfirm) {
      setStatus('Konfirmasi password tidak sama.');
      setStatusType('error');
      return;
    }

    setForgotLoading(true);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail, password: forgotPassword }),
      });

      const data = await response.json();

      if (!data.success) {
        setStatus(data.message || 'Gagal memproses permintaan reset password.');
        setStatusType('error');
        return;
      }

      setStatus(data.message || 'Password berhasil direset. Silakan login.');
      setStatusType('success');
      setShowForgotModal(false);
      setForgotEmail('');
      setForgotPassword('');
      setForgotPasswordConfirm('');
    } catch {
      setStatus('Terjadi masalah jaringan. Coba beberapa saat lagi.');
      setStatusType('error');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="m3-page m3-login-page">
      <section className="m3-hero">
        <h1 className="m3-headline">Masuk ke Akun</h1>
        <p className="m3-subtitle">Gunakan akun terdaftar untuk mulai setor minyak jelantah.</p>
      </section>

      <section className="m3-card m3-stack m3-login-card">
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
          <div className="m3-password-wrap">
            <input
              className="m3-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
            />
            <button
              type="button"
              className="m3-password-toggle"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </label>

        {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

        <div className="m3-row m3-login-actions">
          <button className="m3-button m3-login-submit" onClick={handleLogin} disabled={isLoading}>
            <FiLogIn />
            {isLoading ? 'Memproses...' : 'Login'}
          </button>
          <Link className="m3-link secondary m3-login-register" href="/register">
            <FiUserPlus />
            Buat Akun
          </Link>
        </div>

        <button className="m3-link tertiary m3-login-forgot" type="button" onClick={() => setShowForgotModal(true)}>
          <FiMail />
          Lupa Password
        </button>
      </section>

      {showForgotModal ? (
        <div className="m3-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <section className="m3-card m3-modal m3-stack m3-login-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="m3-section-title">Reset Password</h2>
            <p className="m3-text">Masukkan email dan password baru untuk reset langsung.</p>

            <label className="m3-stack">
              <span className="m3-label">Email</span>
              <input
                className="m3-input"
                placeholder="nama@email.com"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
              />
            </label>

            <label className="m3-stack">
              <span className="m3-label">Password Baru</span>
              <input
                className="m3-input"
                type="password"
                placeholder="Minimal 6 karakter"
                value={forgotPassword}
                onChange={(event) => setForgotPassword(event.target.value)}
              />
            </label>

            <label className="m3-stack">
              <span className="m3-label">Konfirmasi Password Baru</span>
              <input
                className="m3-input"
                type="password"
                placeholder="Ulangi password baru"
                value={forgotPasswordConfirm}
                onChange={(event) => setForgotPasswordConfirm(event.target.value)}
              />
            </label>

            <div className="m3-row">
              <button className="m3-button" type="button" onClick={handleForgotPassword} disabled={forgotLoading}>
                <FiMail />
                {forgotLoading ? 'Memproses...' : 'Reset Sekarang'}
              </button>
              <button className="m3-link secondary" type="button" onClick={() => setShowForgotModal(false)}>
                Batal
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}