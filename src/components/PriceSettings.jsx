import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  getActivePriceMatrix,
  saveActivePriceMatrix,
  resetActivePriceMatrix,
  DEFAULT_PRICE_MATRIX,
  formatRupiah,
  SERVICES,
  PACKAGES,
  CUSTOMER_TIERS,
  getServiceLabel,
  getPackageLabel
} from '../utils/pricing';
import {
  Edit3,
  Check,
  X,
  ShieldAlert,
  CheckCircle,
  RotateCcw,
  Sparkles,
  Info,
  DollarSign
} from 'lucide-react';

export default function PriceSettings({ userProfile }) {
  const [matrix, setMatrix] = useState(getActivePriceMatrix());
  const [isEditing, setIsEditing] = useState(false);
  const [editMatrix, setEditMatrix] = useState(getActivePriceMatrix());
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loaded = getActivePriceMatrix();
    setMatrix(loaded);
    setEditMatrix(loaded);
  }, []);

  const handleStartEdit = () => {
    setEditMatrix(JSON.parse(JSON.stringify(matrix)));
    setIsEditing(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancel = () => {
    setEditMatrix(JSON.parse(JSON.stringify(matrix)));
    setIsEditing(false);
  };

  const handlePriceChange = (serviceKey, pkgKey, tierKey, value) => {
    setEditMatrix((prev) => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        prices: {
          ...prev[serviceKey].prices,
          [pkgKey]: {
            ...prev[serviceKey].prices[pkgKey],
            [tierKey]: Number(value) || 0,
          },
        },
      },
    }));
  };

  const handleDaysChange = (serviceKey, value) => {
    setEditMatrix((prev) => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        estimation_days: Number(value) || 0,
      },
    }));
  };

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      saveActivePriceMatrix(editMatrix);
      setMatrix(editMatrix);
      setIsEditing(false);
      setSuccessMsg('Daftar harga berhasil disimpan dan langsung diterapkan ke sistem kasir.');
    } catch (err) {
      console.error('Error saving price matrix:', err);
      setErrorMsg('Gagal menyimpan daftar harga: ' + (err.message || err));
    }
  };

  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan seluruh daftar harga ke standar pabrikan Berkah Laundry?')) {
      const def = resetActivePriceMatrix();
      setMatrix(def);
      setEditMatrix(def);
      setIsEditing(false);
      setSuccessMsg('Daftar harga telah direset ke tarif standar resmi Berkah Laundry.');
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', textAlign: 'center' }}>
        <ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
        <h3>Akses Ditolak</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginTop: '0.5rem' }}>
          Halaman ini hanya dapat diakses oleh Admin atau Owner Berkah Laundry untuk mengelola tarif dan harga paket.
        </p>
      </div>
    );
  }

  const serviceKeys = ['reguler', 'express', 'express_kilat'];
  const packageKeys = ['cuci_setrika', 'cuci_lipat', 'setrika_saja'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Pengaturan Tarif & Daftar Harga</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Matriks harga per kilogram Berkah Laundry berdasarkan Kecepatan Layanan, Paket Pengerjaan, dan Kategori Domisili Pelanggan.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="btn btn-secondary">
                <X size={15} /> Batal
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                <Check size={15} /> Simpan Perubahan
              </button>
            </>
          ) : (
            <>
              <button onClick={handleReset} className="btn btn-secondary" title="Kembalikan ke tarif default">
                <RotateCcw size={15} /> Reset Standar
              </button>
              <button onClick={handleStartEdit} className="btn btn-primary">
                <Edit3 size={15} /> Ubah Tarif Harga
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="alert-banner alert-banner-error">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-banner alert-banner-success">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Info Notice */}
      <div className="card" style={{ backgroundColor: 'var(--primary-glow)', border: '1px solid hsl(var(--p-h) var(--p-s) var(--p-l) / 0.25)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.875rem' }}>
            <strong>Informasi Kategori Harga:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', lineHeight: '1.5' }}>
              <li><strong>Khusus Orang Kedaung:</strong> Tarif spesial untuk warga lokal sekitar Kedaung.</li>
              <li><strong>Luar Kedaung :</strong> Tarif umum untuk pelanggan luar Kedaung atau layanan jemput/antar.</li>
              <li>Sistem kasir secara otomatis memilih tarif sesuai profil pelanggan yang dipilih.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Price Matrix Table Cards by Service */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {serviceKeys.map((srvKey) => {
          const srvConfig = SERVICES[srvKey];
          const activeSrv = (isEditing ? editMatrix : matrix)[srvKey] || DEFAULT_PRICE_MATRIX[srvKey];

          return (
            <div key={srvKey} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} /> Layanan {srvConfig.name}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Durasi Estimasi: {srvConfig.durationLabel}
                  </span>
                </div>

                {isEditing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Durasi Hari:</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '80px', padding: '0.3rem 0.5rem' }}
                      value={activeSrv.estimation_days}
                      onChange={(e) => handleDaysChange(srvKey, e.target.value)}
                      min={0}
                    />
                  </div>
                )}
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Paket Pengerjaan</th>
                      <th style={{ width: '32%', color: 'var(--success)' }}>
                        🏠 Harga Khusus Kedaung (per kg)
                      </th>
                      <th style={{ width: '33%', color: 'var(--primary)' }}>
                        🚚 Harga Luar Kedaung (per kg)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {packageKeys.map((pkgKey) => {
                      const pkgConfig = PACKAGES[pkgKey];
                      const kedaungPrice = activeSrv.prices?.[pkgKey]?.kedaung ?? DEFAULT_PRICE_MATRIX[srvKey].prices[pkgKey].kedaung;
                      const umumPrice = activeSrv.prices?.[pkgKey]?.umum ?? DEFAULT_PRICE_MATRIX[srvKey].prices[pkgKey].umum;

                      return (
                        <tr key={pkgKey}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{pkgConfig.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pkgConfig.description}</div>
                          </td>

                          {/* Kedaung Price */}
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.85rem' }}>Rp</span>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ maxWidth: '140px', padding: '0.35rem 0.6rem', fontWeight: 'bold' }}
                                  value={kedaungPrice}
                                  onChange={(e) => handlePriceChange(srvKey, pkgKey, 'kedaung', e.target.value)}
                                  step="500"
                                  min="0"
                                />
                              </div>
                            ) : (
                              <span style={{ fontWeight: '700', color: 'var(--success)', fontSize: '1rem' }}>
                                {formatRupiah(kedaungPrice)} / kg
                              </span>
                            )}
                          </td>

                          {/*Luar Kedaung Price */}
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.85rem' }}>Rp</span>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ maxWidth: '140px', padding: '0.35rem 0.6rem', fontWeight: 'bold' }}
                                  value={umumPrice}
                                  onChange={(e) => handlePriceChange(srvKey, pkgKey, 'umum', e.target.value)}
                                  step="500"
                                  min="0"
                                />
                              </div>
                            ) : (
                              <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '1rem' }}>
                                {formatRupiah(umumPrice)} / kg
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
