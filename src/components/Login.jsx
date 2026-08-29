import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { KeyRound, Mail, User, ShieldAlert, Sparkles } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('kasir');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isRegister) {
        // Sign Up with custom metadata (name and role)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName,
              role: role,
            },
          },
        });

        if (error) throw error;
        
        // Supabase might require email confirmation.
        if (data?.user?.identities?.length === 0) {
          setErrorMsg('Email ini sudah terdaftar. Silakan login.');
        } else {
          setSuccessMsg('Registrasi berhasil! Silakan periksa email Anda untuk verifikasi atau langsung login jika konfirmasi email dinonaktifkan.');
          setIsRegister(false);
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (data?.user) {
          onLoginSuccess(data.user);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-shapes">
        <div className="auth-shape auth-shape-1"></div>
        <div className="auth-shape auth-shape-2"></div>
      </div>

      <div className="auth-card">
        <div className="brand-section" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <span className="brand-name" style={{ color: 'var(--text-primary)', background: 'none', WebkitTextFillColor: 'initial', fontSize: '1.6rem' }}>
            Laundria
          </span>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          {isRegister ? 'Buat Akun Baru' : 'Selamat Datang Kembali'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          {isRegister ? 'Daftarkan kasir baru atau owner laundry' : 'Masuk untuk mengelola transaksi kasir'}
        </p>

        {errorMsg && (
          <div className="alert-banner alert-banner-error">
            <ShieldAlert size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-banner alert-banner-success">
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '35px' }}
                  placeholder="Masukkan nama lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Alamat Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: '35px' }}
                placeholder="laundry@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: isRegister ? '1.25rem' : '2rem' }}>
            <label className="form-label">Kata Sandi</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '35px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Role Akses</label>
              <select
                className="form-control"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="kasir">Kasir (Transaksi & Pelanggan)</option>
                <option value="admin">Admin / Owner (Semua Akses & Atur Harga)</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={loading}>
            {loading ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk Dashboard'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun kasir?'}
          </span>{' '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            {isRegister ? 'Masuk di sini' : 'Daftar di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}
