'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clearAuthCache } from '@/lib/auth-cache';
import {
  FiCheck,
  FiGift,
  FiLogOut,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';

const initialSummary = {
  totalUsers: 0,
  pendingSetoran: 0,
  totalLiter: 0,
};

const initialHadiahForm = {
  nama_hadiah: '',
  poin_dibutuhkan: '',
  stok: '',
  deskripsi: '',
};

const initialPetugasForm = {
  nama: '',
  email: '',
  password: '',
  cabang_id: '',
  jabatan: '',
};

const initialCabangForm = {
  kode_cabang: '',
  nama_cabang: '',
  alamat: '',
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

export default function AdminDashboardClient({ userName = 'Admin' }) {
  const [activeTab, setActiveTab] = useState('setoran');
  const [cabangLabel, setCabangLabel] = useState('Cabang belum ditentukan');
  const [summary, setSummary] = useState(initialSummary);
  const [recent, setRecent] = useState([]);
  const [setoranPage, setSetoranPage] = useState(1);
  const [setoranTotalPages, setSetoranTotalPages] = useState(1);
  const [setoranTotalItems, setSetoranTotalItems] = useState(0);
  const [hadiahList, setHadiahList] = useState([]);
  const [petugasList, setPetugasList] = useState([]);
  const [cabangList, setCabangList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showHadiahForm, setShowHadiahForm] = useState(false);
  const [showPetugasForm, setShowPetugasForm] = useState(false);
  const [showCabangForm, setShowCabangForm] = useState(false);
  const [hadiahForm, setHadiahForm] = useState(initialHadiahForm);
  const [hadiahFile, setHadiahFile] = useState(null);
  const [hadiahPreview, setHadiahPreview] = useState('');
  const [petugasForm, setPetugasForm] = useState(initialPetugasForm);
  const [cabangForm, setCabangForm] = useState(initialCabangForm);

  const cards = useMemo(
    () => [
      { label: 'Total Pengguna', value: summary.totalUsers, tone: 'primary' },
      { label: 'Pending Verifikasi', value: summary.pendingSetoran, tone: 'secondary' },
      { label: 'Total Liter Masuk', value: summary.totalLiter, tone: 'tertiary' },
    ],
    [summary]
  );

  const loadDashboard = async (page = 1) => {
    const response = await fetch(`/api/admin/dashboard?page=${page}&limit=10`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Data dashboard tidak tersedia.');
    }

    setSummary(data.summary || initialSummary);
    setRecent(Array.isArray(data.recent) ? data.recent : []);
    setCabangLabel(data.admin?.cabangLabel || 'Cabang belum ditentukan');
    if (data.pagination) {
      setSetoranPage(data.pagination.page);
      setSetoranTotalPages(data.pagination.totalPages);
      setSetoranTotalItems(data.pagination.totalItems);
    }
  };

  const loadHadiah = async () => {
    const response = await fetch('/api/admin/hadiah');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Data hadiah tidak tersedia.');
    }

    setHadiahList(Array.isArray(data.data) ? data.data : []);
  };

  const loadPetugas = async () => {
    const response = await fetch('/api/admin/petugas');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Data petugas tidak tersedia.');
    }

    setPetugasList(Array.isArray(data.data) ? data.data : []);
  };

  const loadCabang = async () => {
    const response = await fetch('/api/admin/cabang');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Data cabang tidak tersedia.');
    }

    setCabangList(Array.isArray(data.data) ? data.data : []);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setIsLoading(true);

      loadDashboard()
        .then(() => loadHadiah())
        .then(() => loadPetugas())
        .then(() => loadCabang())
        .then(() => {
          setStatus('');
          setStatusType('');
        })
        .catch((error) => {
          setStatus(error.message || 'Terjadi gangguan saat memuat data admin.');
          setStatusType('error');
        })
        .finally(() => {
          setIsLoading(false);
        });
    });
  }, []);

  const handleHadiahFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!['image/jpeg', 'image/png'].includes(selectedFile.type)) {
      setStatus('Hanya JPG dan PNG yang diizinkan.');
      setStatusType('error');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setStatus('Ukuran file maksimal 5MB.');
      setStatusType('error');
      return;
    }

    setHadiahFile(selectedFile);
    setStatus('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setHadiahPreview(event.target?.result || '');
    };
    reader.readAsDataURL(selectedFile);
  };

  const clearHadiahFile = () => {
    setHadiahFile(null);
    setHadiahPreview('');
  };

  const handleModerate = async (setoranId, action) => {
    if (!setoranId) {
      setStatus('ID setoran tidak ditemukan.');
      setStatusType('error');
      return;
    }

    const key = `${setoranId}-${action}`;
    setActionLoading(key);

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
        throw new Error(data.message || 'Aksi verifikasi gagal diproses.');
      }

      setStatus(action === 'approve' ? 'Setoran berhasil disetujui.' : 'Setoran berhasil ditolak.');
      setStatusType('success');
      await loadDashboard(setoranPage);
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat memproses aksi.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleTambahHadiah = async () => {
    if (!hadiahForm.nama_hadiah || !hadiahForm.poin_dibutuhkan) {
      setStatus('Nama hadiah dan poin wajib diisi.');
      setStatusType('error');
      return;
    }

    setActionLoading('tambah-hadiah');

    try {
      let fotoContoh = null;

      // Upload file if provided
      if (hadiahFile) {
        const formData = new FormData();
        formData.append('file', hadiahFile);

        const uploadResponse = await fetch('/api/admin/hadiah/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          setStatus('Gagal upload foto. ' + (uploadData.error || ''));
          setStatusType('error');
          setActionLoading('');
          return;
        }

        fotoContoh = uploadData.path;
      }

      const response = await fetch('/api/admin/hadiah', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...hadiahForm,
          poin_dibutuhkan: Number(hadiahForm.poin_dibutuhkan),
          stok: hadiahForm.stok ? Number(hadiahForm.stok) : 0,
          foto_contoh: fotoContoh,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal menambahkan hadiah.');
      }

      setStatus('Hadiah berhasil ditambahkan.');
      setStatusType('success');
      setHadiahForm(initialHadiahForm);
      setHadiahFile(null);
      setHadiahPreview('');
      setShowHadiahForm(false);
      await loadHadiah();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat menambah hadiah.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleHadiahStatus = async (item) => {
    const nextStatus = item.status_hadiah === 'aktif' ? 'nonaktif' : 'aktif';
    const key = `hadiah-status-${item.hadiah_id}`;
    setActionLoading(key);

    try {
      const response = await fetch('/api/admin/hadiah', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hadiah_id: item.hadiah_id,
          status_hadiah: nextStatus,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal mengubah status hadiah.');
      }

      setStatus(`Status hadiah ${item.nama_hadiah} diubah menjadi ${nextStatus}.`);
      setStatusType('success');
      await loadHadiah();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat mengubah status hadiah.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleTambahPetugas = async () => {
    if (!petugasForm.nama || !petugasForm.email || !petugasForm.password || !petugasForm.cabang_id) {
      setStatus('Nama, email, password, dan cabang petugas wajib diisi.');
      setStatusType('error');
      return;
    }

    setActionLoading('tambah-petugas');

    try {
      const response = await fetch('/api/admin/petugas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(petugasForm),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal menambahkan petugas.');
      }

      setStatus('Petugas berhasil ditambahkan.');
      setStatusType('success');
      setPetugasForm(initialPetugasForm);
      setShowPetugasForm(false);
      await loadPetugas();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat menambah petugas.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleTogglePetugasStatus = async (item) => {
    const nextStatus = item.status_petugas === 'aktif' ? 'nonaktif' : 'aktif';
    const key = `petugas-status-${item.petugas_id}`;
    setActionLoading(key);

    try {
      const response = await fetch('/api/admin/petugas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petugas_id: item.petugas_id,
          status_petugas: nextStatus,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal mengubah status petugas.');
      }

      setStatus(`Status petugas ${item.nama} diubah menjadi ${nextStatus}.`);
      setStatusType('success');
      await loadPetugas();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat mengubah status petugas.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleTambahCabang = async () => {
    if (!cabangForm.kode_cabang || !cabangForm.nama_cabang) {
      setStatus('Kode cabang dan nama cabang wajib diisi.');
      setStatusType('error');
      return;
    }

    setActionLoading('tambah-cabang');

    try {
      const response = await fetch('/api/admin/cabang', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cabangForm),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal menambahkan cabang.');
      }

      setStatus('Cabang berhasil ditambahkan.');
      setStatusType('success');
      setCabangForm(initialCabangForm);
      setShowCabangForm(false);
      await loadCabang();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat menambah cabang.');
      setStatusType('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleCabangStatus = async (item) => {
    const key = `cabang-status-${item.cabang_id}`;
    setActionLoading(key);

    try {
      const response = await fetch('/api/admin/cabang', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cabang_id: item.cabang_id,
          aktif: !item.aktif,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal mengubah status cabang.');
      }

      setStatus(`Status cabang ${item.nama_cabang} diubah menjadi ${item.aktif ? 'nonaktif' : 'aktif'}.`);
      setStatusType('success');
      await loadCabang();
    } catch (error) {
      setStatus(error.message || 'Terjadi gangguan jaringan saat mengubah status cabang.');
      setStatusType('error');
    } finally {
      setActionLoading('');
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
          <h1 className="m3-headline">Kelola verifikasi, hadiah, dan tim petugas dari satu tempat.</h1>
          <p className="m3-subtitle">
            Halo, {userName}. Pilih tab yang dibutuhkan, lalu proses setoran atau kelola data operasional tanpa pindah halaman.
          </p>
          <p className="m3-text">Lokasi cabang: {cabangLabel}</p>

          <div className="m3-row m3-home-actions">
            <Link className="m3-button" href="/dashboard">Dashboard User</Link>
            <button className="m3-button secondary" onClick={handleLogout} disabled={isLoggingOut}>
              <FiLogOut />
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

      <section className="m3-tabs-wrap">
        <button
          className={`m3-tab-btn ${activeTab === 'setoran' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('setoran')}
        >
          <FiSettings />
          Verifikasi Setoran
        </button>
        <button
          className={`m3-tab-btn ${activeTab === 'hadiah' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('hadiah')}
        >
          <FiGift />
          Kelola Hadiah
        </button>
        <button
          className={`m3-tab-btn ${activeTab === 'petugas' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('petugas')}
        >
          <FiUsers />
          Kelola Petugas
        </button>
        <button
          className={`m3-tab-btn ${activeTab === 'cabang' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('cabang')}
        >
          <FiMapPin />
          Kelola Cabang
        </button>
      </section>

      {status ? <p className={`m3-status ${statusType}`}>{status}</p> : null}

      {activeTab === 'setoran' ? (
        <section className="m3-stack">
          <article className="m3-card m3-stack m3-panel-card">
            <div className="m3-row m3-row-space">
              <h3 className="m3-section-title">Semua Setoran</h3>
              <span className="m3-chip">{setoranTotalItems} data</span>
            </div>

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
                                <button
                                  className="m3-admin-action-btn approve"
                                  type="button"
                                  onClick={() => handleModerate(setoranId, 'approve')}
                                  disabled={Boolean(actionLoading)}
                                >
                                  <FiCheck />
                                  {actionLoading === `${setoranId}-approve` ? 'Memproses...' : 'Approve'}
                                </button>
                                <button
                                  className="m3-admin-action-btn reject"
                                  type="button"
                                  onClick={() => handleModerate(setoranId, 'reject')}
                                  disabled={Boolean(actionLoading)}
                                >
                                  <FiX />
                                  {actionLoading === `${setoranId}-reject` ? 'Memproses...' : 'Reject'}
                                </button>
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

            {setoranTotalPages > 1 && (
              <div className="m3-row m3-row-space" style={{ paddingTop: '12px' }}>
                <button
                  className="m3-button secondary"
                  type="button"
                  disabled={setoranPage <= 1 || isLoading}
                  onClick={() => {
                    const prev = setoranPage - 1;
                    setSetoranPage(prev);
                    loadDashboard(prev);
                  }}
                >
                  ← Sebelumnya
                </button>
                <span className="m3-text" style={{ fontSize: '14px' }}>
                  Halaman {setoranPage} dari {setoranTotalPages}
                </span>
                <button
                  className="m3-button secondary"
                  type="button"
                  disabled={setoranPage >= setoranTotalPages || isLoading}
                  onClick={() => {
                    const next = setoranPage + 1;
                    setSetoranPage(next);
                    loadDashboard(next);
                  }}
                >
                  Selanjutnya →
                </button>
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'hadiah' ? (
        <section className="m3-stack">
          <article className="m3-card m3-stack m3-panel-card">
            <div className="m3-row m3-row-space">
              <h3 className="m3-section-title">Daftar Hadiah</h3>
              <button className="m3-button" type="button" onClick={() => setShowHadiahForm((prev) => !prev)}>
                <FiPlus />
                Tambah Hadiah
              </button>
            </div>

            {showHadiahForm ? (
              <div className="m3-form-grid">
                <label className="m3-stack">
                  <span className="m3-label">Nama Hadiah</span>
                  <input
                    className="m3-input"
                    placeholder="Contoh: Minyak 1L"
                    value={hadiahForm.nama_hadiah}
                    onChange={(event) => setHadiahForm((prev) => ({ ...prev, nama_hadiah: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Poin Dibutuhkan</span>
                  <input
                    className="m3-input"
                    type="number"
                    placeholder="Contoh: 200"
                    value={hadiahForm.poin_dibutuhkan}
                    onChange={(event) => setHadiahForm((prev) => ({ ...prev, poin_dibutuhkan: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Stok</span>
                  <input
                    className="m3-input"
                    type="number"
                    placeholder="Contoh: 10"
                    value={hadiahForm.stok}
                    onChange={(event) => setHadiahForm((prev) => ({ ...prev, stok: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Deskripsi</span>
                  <input
                    className="m3-input"
                    placeholder="Catatan hadiah"
                    value={hadiahForm.deskripsi}
                    onChange={(event) => setHadiahForm((prev) => ({ ...prev, deskripsi: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Foto Contoh</span>
                  <span style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '8px' }}>
                    (Opsional - JPG atau PNG, maksimal 5MB)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleHadiahFileChange}
                    className="m3-input"
                    style={{ padding: '8px', cursor: 'pointer' }}
                  />
                </label>
                {hadiahPreview && (
                  <div style={{ position: 'relative', gridColumn: '1 / -1' }}>
                    <img
                      src={hadiahPreview}
                      alt="Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: 'var(--md-sys-shape-corner-medium)',
                        border: '1px solid var(--md-sys-color-outline)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={clearHadiahFile}
                      className="m3-button"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '32px',
                        height: '32px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Hapus preview"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                )}
                <div className="m3-row">
                  <button
                    className="m3-button"
                    type="button"
                    onClick={handleTambahHadiah}
                    disabled={actionLoading === 'tambah-hadiah'}
                  >
                    <FiGift />
                    {actionLoading === 'tambah-hadiah' ? 'Menyimpan...' : 'Simpan Hadiah'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="m3-table-wrap m3-admin-table-wrap">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nama</th>
                    <th>Poin</th>
                    <th>Stok</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && hadiahList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="m3-empty-cell">
                        Belum ada hadiah.
                      </td>
                    </tr>
                  ) : (
                    hadiahList.map((item) => {
                      const actionKey = `hadiah-status-${item.hadiah_id}`;

                      return (
                        <tr key={item.hadiah_id}>
                          <td>
                            {item.foto_contoh ? (
                              <img
                                src={item.foto_contoh}
                                alt={item.nama_hadiah}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  objectFit: 'cover',
                                  borderRadius: 'var(--md-sys-shape-corner-small)',
                                  border: '1px solid var(--md-sys-color-outline)',
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>Tidak ada gambar</span>
                            )}
                          </td>
                          <td>{item.nama_hadiah}</td>
                          <td>{item.poin_dibutuhkan}</td>
                          <td>{item.stok}</td>
                          <td>
                            <span className={`m3-chip ${item.status_hadiah === 'aktif' ? 'ok' : 'warn'}`}>
                              {item.status_hadiah}
                            </span>
                          </td>
                          <td>
                            <button
                              className="m3-admin-action-btn"
                              type="button"
                              onClick={() => handleToggleHadiahStatus(item)}
                              disabled={actionLoading === actionKey}
                            >
                              <FiRefreshCw />
                              {actionLoading === actionKey
                                ? 'Memproses...'
                                : item.status_hadiah === 'aktif'
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'}
                            </button>
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
      ) : null}

      {activeTab === 'petugas' ? (
        <section className="m3-stack">
          <article className="m3-card m3-stack m3-panel-card">
            <div className="m3-row m3-row-space">
              <h3 className="m3-section-title">Daftar Petugas</h3>
              <button className="m3-button" type="button" onClick={() => setShowPetugasForm((prev) => !prev)}>
                <FiUserPlus />
                Tambah Petugas
              </button>
            </div>

            {showPetugasForm ? (
              <div className="m3-form-grid">
                <label className="m3-stack">
                  <span className="m3-label">Nama</span>
                  <input
                    className="m3-input"
                    placeholder="Nama petugas"
                    value={petugasForm.nama}
                    onChange={(event) => setPetugasForm((prev) => ({ ...prev, nama: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Email</span>
                  <input
                    className="m3-input"
                    placeholder="email@contoh.com"
                    value={petugasForm.email}
                    onChange={(event) => setPetugasForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Password</span>
                  <input
                    className="m3-input"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={petugasForm.password}
                    onChange={(event) => setPetugasForm((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Jabatan</span>
                  <input
                    className="m3-input"
                    placeholder="Contoh: Supervisor Lapangan"
                    value={petugasForm.jabatan}
                    onChange={(event) => setPetugasForm((prev) => ({ ...prev, jabatan: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Cabang</span>
                  <select
                    className="m3-input"
                    value={petugasForm.cabang_id}
                    onChange={(event) => setPetugasForm((prev) => ({ ...prev, cabang_id: event.target.value }))}
                  >
                    <option value="">Pilih cabang petugas</option>
                    {cabangList
                      .filter((cabang) => cabang.aktif)
                      .map((cabang) => (
                        <option key={cabang.cabang_id} value={cabang.cabang_id}>
                          {cabang.nama_cabang} ({cabang.kode_cabang})
                        </option>
                      ))}
                  </select>
                </label>
                <div className="m3-row">
                  <button
                    className="m3-button"
                    type="button"
                    onClick={handleTambahPetugas}
                    disabled={actionLoading === 'tambah-petugas'}
                  >
                    <FiUserPlus />
                    {actionLoading === 'tambah-petugas' ? 'Menyimpan...' : 'Simpan Petugas'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="m3-table-wrap m3-admin-table-wrap">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Cabang</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && petugasList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="m3-empty-cell">
                        Belum ada petugas.
                      </td>
                    </tr>
                  ) : (
                    petugasList.map((item) => {
                      const actionKey = `petugas-status-${item.petugas_id}`;

                      return (
                        <tr key={item.petugas_id}>
                          <td>{item.nama}</td>
                          <td>{item.email}</td>
                          <td>{item.cabang_nama || '-'}</td>
                          <td>{item.jabatan || '-'}</td>
                          <td>
                            <span className={`m3-chip ${item.status_petugas === 'aktif' ? 'ok' : 'warn'}`}>
                              {item.status_petugas}
                            </span>
                          </td>
                          <td>
                            <button
                              className="m3-admin-action-btn"
                              type="button"
                              onClick={() => handleTogglePetugasStatus(item)}
                              disabled={actionLoading === actionKey}
                            >
                              <FiRefreshCw />
                              {actionLoading === actionKey
                                ? 'Memproses...'
                                : item.status_petugas === 'aktif'
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'}
                            </button>
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
      ) : null}

      {activeTab === 'cabang' ? (
        <section className="m3-stack">
          <article className="m3-card m3-stack m3-panel-card">
            <div className="m3-row m3-row-space">
              <h3 className="m3-section-title">Daftar Cabang</h3>
              <button className="m3-button" type="button" onClick={() => setShowCabangForm((prev) => !prev)}>
                <FiPlus />
                Tambah Cabang
              </button>
            </div>

            {showCabangForm ? (
              <div className="m3-form-grid">
                <label className="m3-stack">
                  <span className="m3-label">Kode Cabang</span>
                  <input
                    className="m3-input"
                    placeholder="Contoh: JKT01"
                    value={cabangForm.kode_cabang}
                    onChange={(event) => setCabangForm((prev) => ({ ...prev, kode_cabang: event.target.value }))}
                  />
                </label>
                <label className="m3-stack">
                  <span className="m3-label">Nama Cabang</span>
                  <input
                    className="m3-input"
                    placeholder="Contoh: Cabang Jakarta Barat"
                    value={cabangForm.nama_cabang}
                    onChange={(event) => setCabangForm((prev) => ({ ...prev, nama_cabang: event.target.value }))}
                  />
                </label>
                <label className="m3-stack" style={{ gridColumn: '1 / -1' }}>
                  <span className="m3-label">Alamat</span>
                  <input
                    className="m3-input"
                    placeholder="Alamat lengkap cabang"
                    value={cabangForm.alamat}
                    onChange={(event) => setCabangForm((prev) => ({ ...prev, alamat: event.target.value }))}
                  />
                </label>
                <div className="m3-row">
                  <button
                    className="m3-button"
                    type="button"
                    onClick={handleTambahCabang}
                    disabled={actionLoading === 'tambah-cabang'}
                  >
                    <FiMapPin />
                    {actionLoading === 'tambah-cabang' ? 'Menyimpan...' : 'Simpan Cabang'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="m3-table-wrap m3-admin-table-wrap">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Cabang</th>
                    <th>Alamat</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && cabangList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="m3-empty-cell">
                        Belum ada cabang.
                      </td>
                    </tr>
                  ) : (
                    cabangList.map((item) => {
                      const actionKey = `cabang-status-${item.cabang_id}`;

                      return (
                        <tr key={item.cabang_id}>
                          <td>{item.kode_cabang}</td>
                          <td>{item.nama_cabang}</td>
                          <td>{item.alamat || '-'}</td>
                          <td>
                            <span className={`m3-chip ${item.aktif ? 'ok' : 'warn'}`}>
                              {item.aktif ? 'aktif' : 'nonaktif'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="m3-admin-action-btn"
                              type="button"
                              onClick={() => handleToggleCabangStatus(item)}
                              disabled={actionLoading === actionKey}
                            >
                              <FiRefreshCw />
                              {actionLoading === actionKey
                                ? 'Memproses...'
                                : item.aktif
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'}
                            </button>
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
      ) : null}
    </main>
  );
}
