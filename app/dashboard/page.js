'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearAuthCache, getAuthCache } from '@/lib/auth-cache';
import { FiGift, FiLogOut, FiShield, FiSend } from 'react-icons/fi';

const initialSummary = {
  poin: 0,
  pendingLiter: 0,
  approvedLiter: 0,
};

export default function DashboardPage() {
  const [userName, setUserName] = useState('Pengguna');
  const [isAdmin, setIsAdmin] = useState(false);
  const [cabangLabel, setCabangLabel] = useState('Cabang belum ditentukan');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [summary, setSummary] = useState(initialSummary);
  const [summaryWarning, setSummaryWarning] = useState('');
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const cachedUser = getAuthCache();

    if (!cachedUser) {
      window.location.href = '/login';
      return;
    }

    const loadSummary = async () => {
      setUserName(cachedUser?.nama || 'Pengguna');
      setIsAdmin(cachedUser?.role === 'admin');

      try {
        const response = await fetch('/api/user/summary');
        const data = await response.json();

        if (!data.success) {
          return;
        }

        setSummary(data.summary || initialSummary);
        setUserName(data.user?.nama || cachedUser?.nama || 'Pengguna');
        setCabangLabel(data.user?.cabang_label || 'Cabang belum ditentukan');
        setRecentActivity(Array.isArray(data.activity) ? data.activity : []);

        if (data.pointsApplied === false) {
          setSummaryWarning('Kolom poin user belum tersedia di database.');
        } else {
          setSummaryWarning('');
        }
      } catch {
        setSummaryWarning('Ringkasan poin belum bisa dimuat sementara.');
      }
    };

    queueMicrotask(() => {
      void loadSummary();
    });
  }, []);

  const quickFacts = [
    { label: 'Poin aktif', value: String(summary.poin), hint: 'Bertambah setelah verifikasi setoran', tone: 'primary' },
    { label: 'Setoran berjalan', value: `${summary.pendingLiter.toFixed(1)} L`, hint: 'Menunggu verifikasi', tone: 'secondary' },
    { label: 'Liter terverifikasi', value: `${summary.approvedLiter.toFixed(1)} L`, hint: 'Total setoran yang disetujui', tone: 'tertiary' },
  ];

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
    <main className="m3-page m3-home-page">
      <section className="m3-hero m3-home-hero">
        <div className="m3-hero-copy">
          <p className="m3-kicker">Setor Minyak Jelantah</p>
          <h1 className="m3-headline">Dashboard yang lebih segar, lebih jelas, dan lebih cepat dipakai.</h1>
          <p className="m3-subtitle">
            Halo, {userName}. Pantau poin, lihat progres setoran, lalu kirim minyak dengan alur yang lebih rapi.
          </p>
          <p className="m3-text">Lokasi cabang: {cabangLabel}</p>

          <div className="m3-row m3-home-actions">
            <Link className="m3-button" href="/setor">
              <FiSend />
              Mulai Setor
            </Link>
            <Link className="m3-link secondary" href="/hadiah">
              <FiGift />
              Tukar Hadiah
            </Link>
            {isAdmin ? (
              <Link className="m3-link tertiary" href="/admin">
                <FiShield />
                Panel Admin
              </Link>
            ) : null}
            <button className="m3-button secondary" onClick={handleLogout} disabled={isLoggingOut}>
              <FiLogOut />
              {isLoggingOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </div>

        <aside className="m3-hero-spotlight">
          <div className="m3-spotlight-ring" />
          <p className="m3-spotlight-label">Total Poin</p>
          <div className="m3-stat m3-stat-large">{summary.poin}</div>
          <p className="m3-spotlight-note">Ditukar menjadi manfaat dan penghargaan.</p>
          <div className="m3-mini-pills">
            <span className="m3-chip ok">Aktif</span>
            <span className="m3-chip">Terverifikasi</span>
          </div>
        </aside>
      </section>

      {summaryWarning ? <p className="m3-status error">{summaryWarning}</p> : null}

      <section className="m3-stat-grid">
        {quickFacts.map((item) => (
          <article key={item.label} className={`m3-card m3-fact-card ${item.tone}`}>
            <p className="m3-title">{item.label}</p>
            <h2 className="m3-stat">{item.value}</h2>
            <p className="m3-text">{item.hint}</p>
          </article>
        ))}
      </section>

      <section className="m3-stack">
        <article className="m3-card m3-stack m3-panel-card">
          <div className="m3-row m3-row-space">
            <h3 className="m3-section-title">Aktivitas Terbaru</h3>
            <span className="m3-chip warn">Live</span>
          </div>

          <div className="m3-activity-list">
            {recentActivity.length === 0 ? (
              <div className="m3-activity-item">
                <span className="m3-activity-dot" />
                <div>
                  <p className="m3-activity-title">Belum ada aktivitas</p>
                  <p className="m3-activity-meta">Setor minyak atau tukar hadiah untuk mulai mengisi riwayat.</p>
                </div>
              </div>
            ) : (
              recentActivity.map((item) => (
                <div key={`${item.title}-${item.meta}`} className="m3-activity-item">
                  <span className={`m3-activity-dot ${item.tone || ''}`} />
                  <div>
                    <p className="m3-activity-title">{item.title}</p>
                    <p className="m3-activity-meta">{item.meta}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
