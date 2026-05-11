'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiUserPlus } from 'react-icons/fi';

export default function RegisterPage() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cabangId, setCabangId] = useState('');
  const [cabangList, setCabangList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const response = await fetch('/api/cabang');
        const data = await response.json();
        if (data.success) {
          setCabangList(Array.isArray(data.data) ? data.data : []);
        }
      } catch {
        setCabangList([]);
      }
    });
  }, []);

  const handleRegister = async () => {
    setStatus('');
    setStatusType('');

    if (!nama || !email || !password || !cabangId) {
      setStatus('Nama, email, password, dan cabang wajib diisi.');
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
        body: JSON.stringify({ nama, email, password, cabang_id: Number(cabangId) }),
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
      setCabangId('');
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
        <h1 className="m3-headline">Buat Akun</h1>
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

        <label className="m3-stack">
          <span className="m3-label">Cabang</span>
          <select className="m3-input" value={cabangId} onChange={(e) => setCabangId(e.target.value)}>
            <option value="">Pilih cabang</option>
            {cabangList.map((cabang) => (
              <option key={cabang.cabang_id} value={cabang.cabang_id}>
                {cabang.nama_cabang} ({cabang.kode_cabang})
              </option>
            ))}
          </select>
        </label>

        {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

        <div className="m3-row">
          <button className="m3-button" onClick={handleRegister} disabled={isLoading}>
            <FiUserPlus />
            {isLoading ? 'Menyimpan...' : 'Buat Akun'}
          </button>
          <Link className="m3-link secondary" href="/login">
            <FiArrowLeft />
            Kembali ke Login
          </Link>
        </div>
      </section>
    </main>
  );
}
