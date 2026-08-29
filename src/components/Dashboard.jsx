import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, RefreshCw, ShoppingBag, CheckCircle, Clock } from 'lucide-react';

export default function Dashboard({ userProfile, setTab }) {
  const [stats, setStats] = useState({
    todayTransactions: 0,
    todayRevenue: 0,
    activeOrders: 0,
    completedOrders: 0,
  });
  const [activeTransactions, setActiveTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // 1. Fetch Today's Transactions Count & Revenue
      const { data: todayData, error: todayError } = await supabase
        .from('transactions')
        .select('total_price, created_at')
        .gte('created_at', todayStr);

      if (todayError) throw todayError;

      const todayTransactions = todayData ? todayData.length : 0;
      const todayRevenue = todayData ? todayData.reduce((acc, curr) => acc + Number(curr.total_price), 0) : 0;

      // 2. Fetch Active Orders (statuses: 'belum_diproses', 'diproses')
      const { count: activeCount, error: activeError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['belum_diproses', 'diproses']);

      if (activeError) throw activeError;

      // 3. Fetch Completed Orders (statuses: 'selesai', 'sudah_diambil')
      const { count: completedCount, error: completedError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['selesai', 'sudah_diambil']);

      if (completedError) throw completedError;

      setStats({
        todayTransactions,
        todayRevenue,
        activeOrders: activeCount || 0,
        completedOrders: completedCount || 0,
      });

      // 4. Fetch 5 Recent Active Transactions
      const { data: recentData, error: recentError } = await supabase
        .from('transactions')
        .select(`
          id,
          receipt_number,
          total_price,
          status,
          created_at,
          customers ( name, phone )
        `)
        .in('status', ['belum_diproses', 'diproses'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      setActiveTransactions(recentData || []);

    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'belum_diproses': return <span className="badge badge-danger">Belum Diproses</span>;
      case 'diproses': return <span className="badge badge-warning">Diproses</span>;
      case 'selesai': return <span className="badge badge-success">Selesai</span>;
      case 'sudah_diambil': return <span className="badge badge-primary">Sudah Diambil</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Halo, {userProfile?.name || 'Kasir'} 👋</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Berikut adalah ringkasan performa laundry hari ini.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboardData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          Perbarui
        </button>
      </div>

      {/* Stats Widgets */}
      <div className="grid-cols-1-3" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pendapatan Hari Ini</span>
            <span className="stat-value">{formatRupiah(stats.todayRevenue)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--success-glow)', color: 'var(--success)' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Transaksi Hari Ini</span>
            <span className="stat-value">{stats.todayTransactions} Transaksi</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--warning-glow)', color: 'var(--warning)' }}>
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Cucian Sedang Diproses</span>
            <span className="stat-value">{stats.activeOrders} Antrean</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Shortcuts & Recent Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', alignItems: 'start' }} className="grid-cols-1-3">
        {/* Quick Links / Navigation shortcuts */}
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Pintasan Cepat</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => setTab('transactions')}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              + Buat Transaksi Baru
            </button>
            <button
              onClick={() => setTab('customers')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              + Tambah Pelanggan Baru
            </button>
            {userProfile?.role === 'admin' && (
              <button
                onClick={() => setTab('prices')}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'flex-start', borderStyle: 'dashed' }}
              >
                ⚙️ Atur Daftar Harga
              </button>
            )}
          </div>
        </div>

        {/* Recent Active Orders */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <h3>Antrean Cucian Aktif Terkini</h3>
            <button
              onClick={() => setTab('transactions')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Lihat Semua
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat data antrean...</p>
          ) : activeTransactions.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Tidak ada cucian yang sedang diproses. Kerja bagus!</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>No. Resi</th>
                    <th>Nama Pelanggan</th>
                    <th>Tanggal</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{tx.receipt_number}</td>
                      <td>{tx.customers?.name || 'Umum'}</td>
                      <td>{new Date(tx.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</td>
                      <td>{formatRupiah(tx.total_price)}</td>
                      <td>{getStatusLabel(tx.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
