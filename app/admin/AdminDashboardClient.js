'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clearAuthCache } from '@/lib/auth-cache';

const initialSummary = {
  totalUsers: 0,
  pendingSetoran: 0,
  totalLiter: 0,
};

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminDashboardClient() {
  const [summary, setSummary] = useState(initialSummary);
  const [recent, setRecent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary || initialSummary);
        setRecent(Array.isArray(data.recent) ? data.recent : []);
        setStatus('');
        setStatusType('');
      } else {
        setStatus(data.message || 'Data dashboard tidak tersedia.');
        setStatusType('error');
      }
    } catch {
      setStatus('Terjadi gangguan jaringan saat memuat data.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Defer first load to avoid synchronous setState call directly inside effect body.
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Total Pengguna', value: summary.totalUsers, tone: 'primary' },
      { label: 'Pending Verifikasi', value: summary.pendingSetoran, tone: 'secondary' },
      { label: 'Total Liter Masuk', value: summary.totalLiter, tone: 'tertiary' },
    ],
    [summary]
  );

  const handleModerate = async (setoranId, action) => {
    if (!setoranId) {
      setStatus('ID setoran tidak ditemukan.');
      setStatusType('error');
      return;
    }

    setActionLoading(`${setoranId}-${action}`);
    setStatus('');
    setStatusType('');

    try {
      const response = await fetch('/api/admin/setoran', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setoranId, action }),
      });

      const data = await response.json();

      if (!data.success) {
        setStatus(data.message || 'Aksi verifikasi gagal diproses.');
        setStatusType('error');
        return;
      }

      if (typeof data.pointsDelta === 'number' && data.pointsDelta !== 0) {
        const sign = data.pointsDelta > 0 ? '+' : '';
        setStatus(
          action === 'approve'
            ? `Setoran berhasil disetujui. Poin user ${sign}${data.pointsDelta}.`
            : `Setoran berhasil ditolak. Penyesuaian poin user ${sign}${data.pointsDelta}.`
        );
      } else if (data.pointsApplied === false) {
        setStatus('Status setoran berubah, tetapi kolom poin user belum tersedia di database.');
        setStatusType('error');
      } else {
        setStatus(action === 'approve' ? 'Setoran berhasil disetujui.' : 'Setoran berhasil ditolak.');
        setStatusType('success');
      }

      if (data.pointsApplied !== false && !(typeof data.pointsDelta === 'number' && data.pointsDelta !== 0)) {
        setStatusType('success');
      }

      await loadDashboard();
    } catch {
      setStatus('Terjadi gangguan jaringan saat memproses aksi.');
      setStatusType('error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch('/api/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors here; local cache clear is enough to log out on client side.
    } finally {
      clearAuthCache();
      window.location.href = '/login';
    }
  };

  return (
    <main className="m3-page m3-admin-page">
      <section className="m3-hero m3-home-hero m3-admin-hero">
        <div className="m3-hero-copy">
          <p className="m3-kicker">Panel Admin</p>
          <h1 className="m3-headline">Verifikasi setoran lebih cepat, tampilannya tetap ringan dan jelas.</h1>
          <p className="m3-subtitle">
            Halo, petugas. Pantau antrean verifikasi, cek total liter masuk, lalu proses setoran dari satu layar yang rapi.
          </p>

          <div className="m3-row m3-home-actions">
            <Link className="m3-button" href="/dashboard">Dashboard User</Link>
            <Link className="m3-link secondary" href="/setor">Input Setoran</Link>
            <button className="m3-button secondary" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </div>

        <aside className="m3-hero-spotlight">
          <div className="m3-spotlight-ring" />
          <p className="m3-spotlight-label">Pending Verifikasi</p>
          <div className="m3-stat m3-stat-large">{isLoading ? '...' : summary.pendingSetoran}</div>
          <p className="m3-spotlight-note">
            {isLoading ? 'Memuat ringkasan antrean masuk.' : `${Number(summary.totalLiter || 0).toFixed(1)} L sudah tercatat.`}
          </p>
          <div className="m3-mini-pills">
            <span className="m3-chip warn">Siap proses</span>
            <span className="m3-chip">{isLoading ? '...' : `${summary.totalUsers} pengguna`}</span>
          </div>
        </aside>
      </section>

      <section className="m3-stat-grid">
        {cards.map((item) => (
          <article key={item.label} className={`m3-card m3-fact-card ${item.tone}`}>
            <p className="m3-title">{item.label}</p>
            <h2 className="m3-stat">{isLoading ? '...' : item.value}</h2>
            <p className="m3-text">
              {item.label === 'Total Pengguna'
                ? 'Semua akun yang sudah terdaftar di sistem.'
                : item.label === 'Pending Verifikasi'
                  ? 'Menunggu keputusan approve atau reject.'
                  : 'Akumulasi minyak yang sudah masuk ke sistem.'}
            </p>
          </article>
        ))}
      </section>

      <section className="m3-stack">
        <article className="m3-card m3-stack m3-panel-card">
          <div className="m3-row m3-row-space">
            <h3 className="m3-section-title">Setoran Terbaru</h3>
            <span className="m3-chip">{recent.length} data</span>
          </div>

          {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

          <div className="m3-table-wrap m3-admin-table-wrap">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Liter</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="m3-empty-cell">
                      Belum ada data setoran.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, index) => {
                    const setoranId = row.setoran_id ?? row.id ?? row.id_setoran;
                    const isPending = String(row.status_verifikasi || '').toLowerCase() === 'pending';
                    const normalizedStatus = String(row.status_verifikasi || '').toLowerCase();
                    const canModerate = Boolean(setoranId && isPending);

                    return (
                      <tr key={`${setoranId || row.user_id}-${row.tanggal_setor}-${index}`}>
                        <td>{row.nama || `User #${row.user_id}`}</td>
                        <td>{Number(row.jumlah_liter || 0).toFixed(2)} L</td>
                        <td>
                          <span
                            className={`m3-chip ${
                              normalizedStatus === 'pending' ? 'warn' : normalizedStatus === 'approved' ? 'ok' : 'reject'
                            }`}
                          >
                            {row.status_verifikasi || '-'}
                          </span>
                        </td>
                        <td>{formatDate(row.tanggal_setor)}</td>
                        <td>
                          {canModerate ? (
                            <div className="m3-row m3-action-row">
                              {['approve', 'reject'].map((action) => (
                                <button
                                  key={action}
                                  className={`m3-admin-action-btn ${action}`}
                                  onClick={() => handleModerate(setoranId, action)}
                                  disabled={Boolean(actionLoading)}
                                >
                                  {actionLoading === `${setoranId}-${action}`
                                    ? 'Memproses...'
                                    : action === 'approve'
                                      ? 'Approve'
                                      : 'Reject'}
                                </button>
                              ))}
                            </div>
                          ) : isPending ? (
                            <span className="m3-text">ID tidak tersedia</span>
                          ) : (
                            <span className="m3-text">Selesai</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
