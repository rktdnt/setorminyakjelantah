'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getAuthCache } from '@/lib/auth-cache';

export default function Setor() {
  const [liter, setLiter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');

  const handleSubmit = async () => {
    setStatus('');
    setStatusType('');

    const parsedLiter = Number(liter);

    if (!Number.isFinite(parsedLiter) || parsedLiter <= 0) {
      setStatus('Jumlah liter harus lebih dari 0.');
      setStatusType('error');
      return;
    }

    const user = getAuthCache();

    if (!user) {
      setStatus('Silakan login dulu sebelum setor.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/setor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.user_id,
          liter: parsedLiter,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('Setoran berhasil dikirim. Menunggu verifikasi admin.');
        setStatusType('success');
        setLiter('');
        return;
      }

      setStatus('Setoran gagal diproses. Coba lagi.');
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
        <h1 className="m3-headline">Form Setor Minyak</h1>
        <p className="m3-subtitle">Masukkan jumlah liter untuk proses setoran hari ini.</p>
      </section>

      <section className="m3-card m3-stack">
        <label className="m3-stack">
          <span className="m3-label">Jumlah Liter</span>
          <input
            className="m3-input"
            placeholder="Contoh: 2.5"
            inputMode="decimal"
            value={liter}
            onChange={(e) => setLiter(e.target.value)}
          />
        </label>

        {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

        <div className="m3-row">
          <button className="m3-button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Mengirim...' : 'Kirim Setoran'}
          </button>
          <Link className="m3-link secondary" href="/dashboard">Kembali</Link>
        </div>
      </section>
    </main>
  );
}