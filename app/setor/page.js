'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getAuthCache } from '@/lib/auth-cache';
import { FiImage, FiX } from 'react-icons/fi';

export default function Setor() {
  const [liter, setLiter] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');

  const handleFileChange = (e) => {
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

    setFile(selectedFile);
    setStatus('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result || '');
    };
    reader.readAsDataURL(selectedFile);
  };

  const clearFile = () => {
    setFile(null);
    setPreview('');
  };

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
      let fotoBukti = null;

      // Upload file if provided
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/setor/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          setStatus('Gagal upload foto. ' + (uploadData.error || ''));
          setStatusType('error');
          setIsLoading(false);
          return;
        }

        fotoBukti = uploadData.path;
      }

      const response = await fetch('/api/setor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.user_id,
          liter: parsedLiter,
          foto_bukti: fotoBukti,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('Setoran berhasil dikirim. Menunggu verifikasi admin.');
        setStatusType('success');
        setLiter('');
        clearFile();
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

        <label className="m3-stack">
          <span className="m3-label">
            <FiImage style={{ display: 'inline', marginRight: '8px' }} />
            Foto Bukti Setoran
          </span>
          <span style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '8px' }}>
            (Opsional - JPG atau PNG, maksimal 5MB)
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            className="m3-input"
            style={{ padding: '8px', cursor: 'pointer' }}
          />
        </label>

        {preview && (
          <div className="m3-stack" style={{ alignItems: 'center', position: 'relative' }}>
            <img
              src={preview}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: 'var(--md-sys-shape-corner-medium)',
                border: '1px solid var(--md-sys-color-outline)',
              }}
            />
            <button
              type="button"
              onClick={clearFile}
              className="m3-button"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '40px',
                height: '40px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Hapus preview"
            >
              <FiX size={20} />
            </button>
          </div>
        )}

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