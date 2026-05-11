'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HadiahPage() {
  const [poin, setPoin] = useState(0);
  const [hadiah, setHadiah] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [loadingId, setLoadingId] = useState(null);

  const loadData = async () => {
    try {
      const [hadiahRes, riwayatRes] = await Promise.all([
        fetch('/api/user/hadiah'),
        fetch('/api/user/penukaran'),
      ]);

      const hadiahData = await hadiahRes.json();
      const riwayatData = await riwayatRes.json();

      if (hadiahData.success) {
        setPoin(Number(hadiahData.poin || 0));
        setHadiah(Array.isArray(hadiahData.hadiah) ? hadiahData.hadiah : []);
      }

      if (riwayatData.success) {
        setRiwayat(Array.isArray(riwayatData.items) ? riwayatData.items : []);
      }
    } catch {
      setStatus('Gagal memuat data hadiah.');
      setStatusType('error');
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, []);

  const handleRedeem = async (item) => {
    setStatus('');
    setStatusType('');
    setLoadingId(item.hadiah_id);

    try {
      const response = await fetch('/api/user/penukaran', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hadiah_id: item.hadiah_id, jumlah: 1 }),
      });

      const data = await response.json();

      if (!data.success) {
        setStatus(data.message || 'Penukaran gagal diproses.');
        setStatusType('error');
        return;
      }

      setStatus(data.message || 'Penukaran berhasil diproses.');
      setStatusType('success');
      await loadData();
    } catch {
      setStatus('Terjadi masalah jaringan saat menukar hadiah.');
      setStatusType('error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main className="m3-page">
      <section className="m3-hero m3-home-hero">
        <div className="m3-hero-copy">
          <p className="m3-kicker">Pusat Hadiah</p>
          <h1 className="m3-headline">Tukar poin jadi hadiah menarik.</h1>
          <p className="m3-subtitle">Pilih hadiah yang kamu inginkan dan tukarkan dengan poin yang sudah terkumpul.</p>
          <div className="m3-row">
            <Link className="m3-link secondary" href="/dashboard">Kembali ke Dashboard</Link>
            <Link className="m3-link" href="/setor">Tambah Poin dari Setoran</Link>
          </div>
        </div>

        <aside className="m3-hero-spotlight">
          <p className="m3-spotlight-label">Poin Tersedia</p>
          <div className="m3-stat m3-stat-large">{poin}</div>
          <p className="m3-spotlight-note">Semakin banyak poin, semakin banyak hadiah yang bisa ditukar.</p>
        </aside>
      </section>

      {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

      <section className="m3-card m3-stack">
        <div className="m3-row m3-row-space">
          <h3 className="m3-section-title">Daftar Hadiah</h3>
          <span className="m3-chip">{hadiah.length} item</span>
        </div>

        <div className="m3-reward-grid">
          {hadiah.length === 0 ? (
            <p className="m3-text">Belum ada hadiah aktif.</p>
          ) : (
            hadiah.map((item) => {
              const canRedeem = poin >= Number(item.poin_dibutuhkan || 0) && Number(item.stok || 0) > 0;

              return (
                <article key={item.hadiah_id} className="m3-card m3-reward-card">
                  {item.foto_contoh && (
                    <img
                      src={item.foto_contoh}
                      alt={item.nama_hadiah}
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover',
                        borderRadius: 'var(--md-sys-shape-corner-medium)',
                        marginBottom: '16px',
                        border: '1px solid var(--md-sys-color-outline)',
                      }}
                    />
                  )}
                  <p className="m3-title">{item.nama_hadiah}</p>
                  <p className="m3-text">{item.deskripsi || 'Hadiah penukaran poin'}</p>
                  <p className="m3-stat">{item.poin_dibutuhkan} poin</p>
                  <p className="m3-text">Stok: {item.stok}</p>
                  <button
                    className="m3-button"
                    onClick={() => handleRedeem(item)}
                    disabled={!canRedeem || loadingId === item.hadiah_id}
                  >
                    {loadingId === item.hadiah_id ? 'Memproses...' : canRedeem ? 'Tukar Sekarang' : 'Poin/Stok Tidak Cukup'}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="m3-card m3-stack">
        <div className="m3-row m3-row-space">
          <h3 className="m3-section-title">Riwayat Penukaran</h3>
          <span className="m3-chip warn">Terbaru</span>
        </div>

        <div className="m3-table-wrap">
          <table className="m3-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Hadiah</th>
                <th>Jumlah</th>
                <th>Poin Dipakai</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.length === 0 ? (
                <tr>
                  <td colSpan={6} className="m3-empty-cell">Belum ada riwayat penukaran.</td>
                </tr>
              ) : (
                riwayat.map((row) => (
                  <tr key={row.penukaran_id}>
                    <td>
                      {row.foto_contoh ? (
                        <img
                          src={row.foto_contoh}
                          alt={row.nama_hadiah}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'cover',
                            borderRadius: 'var(--md-sys-shape-corner-small)',
                            border: '1px solid var(--md-sys-color-outline)',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>-</span>
                      )}
                    </td>
                    <td>{row.nama_hadiah}</td>
                    <td>{row.jumlah}</td>
                    <td>{row.total_poin_dipakai}</td>
                    <td>
                      <span className={`m3-chip ${String(row.status_penukaran).toLowerCase() === 'done' ? 'ok' : ''}`}>
                        {row.status_penukaran}
                      </span>
                    </td>
                    <td>{new Date(row.requested_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
