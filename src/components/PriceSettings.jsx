import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Edit3, Check, X, ShieldAlert, CheckCircle } from 'lucide-react';

export default function PriceSettings({ userProfile }) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editDays, setEditDays] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .order('service', { ascending: true });

      if (error) throw error;
      setPrices(data || []);
    } catch (err) {
      console.error('Error fetching price list:', err);
      setErrorMsg('Gagal mengambil daftar harga.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const handleEditClick = (item) => {
    setEditingService(item.service);
    setEditPrice(item.price_per_kg);
    setEditDays(item.estimation_days);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancel = () => {
    setEditingService(null);
  };

  const handleSave = async (service) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('price_list')
        .update({
          price_per_kg: Number(editPrice),
          estimation_days: Number(editDays),
        })
        .eq('service', service);

      if (error) throw error;

      setSuccessMsg(`Harga untuk layanan ${getServiceLabel(service)} berhasil diperbarui.`);
      setEditingService(null);
      fetchPrices();
    } catch (err) {
      console.error('Error updating price:', err);
      setErrorMsg(err.message || 'Gagal memperbarui harga. Pastikan Anda memiliki hak akses Admin.');
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getServiceLabel = (service) => {
    switch (service) {
      case 'reguler': return 'Reguler';
      case 'express': return 'Express (Biasa)';
      case 'express_kilat': return 'Express Kilat';
      default: return service;
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', textAlign: 'center' }}>
        <ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
        <h3>Akses Ditolak</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginTop: '0.5rem' }}>
          Halaman ini hanya dapat diakses oleh Admin atau Owner laundry untuk mengelola harga paket dan jenis layanan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Pengaturan Daftar Harga</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Sesuaikan nominal harga per kilogram dan estimasi durasi selesai tiap layanan laundry.</p>
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

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat data harga...</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Layanan</th>
                  <th>Estimasi Selesai</th>
                  <th>Harga per kg</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((item) => {
                  const isEditing = editingService === item.service;
                  return (
                    <tr key={item.service}>
                      <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                        {getServiceLabel(item.service)}
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '80px', padding: '0.35rem 0.5rem' }}
                              value={editDays}
                              onChange={(e) => setEditDays(e.target.value)}
                              min={0}
                            />
                            <span style={{ fontSize: '0.85rem' }}>Hari</span>
                          </div>
                        ) : (
                          `${item.estimation_days} Hari (${item.estimation_days === 0 ? 'Hari yang sama' : `${item.estimation_days} hari kerja`})`
                        )}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem' }}>Rp</span>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '120px', padding: '0.35rem 0.5rem' }}
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              min={0}
                            />
                          </div>
                        ) : (
                          formatRupiah(item.price_per_kg)
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleSave(item.service)}
                              className="btn btn-primary"
                              style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                            >
                              <Check size={14} /> Simpan
                            </button>
                            <button
                              onClick={handleCancel}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                            >
                              <X size={14} /> Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Edit3 size={14} /> Ubah Harga
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
