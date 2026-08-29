import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Customers from './components/Customers';
import PriceSettings from './components/PriceSettings';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Settings, 
  LogOut, 
  Sparkles, 
  Calendar,
  AlertTriangle,
  Database
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 1. Live Date Clock in Header
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Check Supabase connection and handle auth session
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role and details from profiles
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Fallback: If profile isn't inserted yet by Postgres trigger
        console.warn('Profile not found yet, retrying in 1.5 seconds...');
        setTimeout(() => fetchUserProfile(userId), 1500);
        return;
      }

      setUserProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // If Supabase has not been configured in env variables
  if (!isSupabaseConfigured()) {
    return (
      <div className="auth-page" style={{ padding: '2rem' }}>
        <div className="auth-bg-shapes">
          <div className="auth-shape auth-shape-1"></div>
          <div className="auth-shape auth-shape-2"></div>
        </div>
        <div className="auth-card" style={{ maxWidth: '550px', textAlign: 'center' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1.5rem', backgroundColor: 'var(--danger-glow)', color: 'var(--danger)' }}>
            <Database size={24} />
          </div>
          <h2 style={{ marginBottom: '1rem' }}>Konfigurasi Supabase Diperlukan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Aplikasi Laundria membutuhkan database Supabase untuk beroperasi. File `.env` belum dikonfigurasi dengan benar atau nilainya masih kosong.
          </p>

          <div style={{ textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.03)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={14} color="var(--warning)" /> Langkah-langkah penyelesaian:
            </h4>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <li>
                Salin file <strong>.env.example</strong> menjadi <strong>.env</strong> di direktori proyek ini.
              </li>
              <li>
                Isi variabel <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> dengan kredensial API dari project dashboard Supabase Anda.
              </li>
              <li>
                Jalankan script yang ada di dalam <strong>schema.sql</strong> di SQL Editor Supabase untuk membangun struktur tabel.
              </li>
              <li>
                Restart server pengembangan Vite Anda untuk memuat perubahan file env.
              </li>
            </ol>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Laundria — Aplikasi Kasir Laundry Premium
          </p>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-icon spin-anim" style={{ margin: '0 auto 1rem', width: '3.5rem', height: '3.5rem' }}>
            <Sparkles size={28} />
          </div>
          <h3>Memuat Aplikasi...</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Menghubungkan ke server database</p>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (!session) {
    return <Login onLoginSuccess={(user) => fetchUserProfile(user.id)} />;
  }

  // Helper to change page headers
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Beranda Dashboard';
      case 'transactions': return 'Kelola Transaksi';
      case 'customers': return 'Daftar Pelanggan';
      case 'prices': return 'Pengaturan Harga';
      default: return 'Laundria';
    }
  };

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <span className="brand-name">Laundria</span>
        </div>

        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('dashboard')}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          </li>
          
          <li className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('transactions')}>
              <ClipboardList size={18} />
              <span>Transaksi</span>
            </button>
          </li>

          <li className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('customers')}>
              <Users size={18} />
              <span>Pelanggan</span>
            </button>
          </li>

          {userProfile?.role === 'admin' && (
            <li className={`nav-item ${activeTab === 'prices' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('prices')}>
                <Settings size={18} />
                <span>Atur Harga</span>
              </button>
            </li>
          )}
        </ul>

        {/* User profile section at the bottom */}
        <div className="user-profile-section">
          <div className="user-info">
            <div className="user-avatar">
              {userProfile?.name?.charAt(0).toUpperCase() || 'K'}
            </div>
            <div className="user-meta">
              <span className="user-name">{userProfile?.name || 'Kasir'}</span>
              <span className="user-role">{userProfile?.role || 'kasir'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-title">
            <h1>{getTabTitle()}</h1>
            <p>Sistem Kasir & Pelacak Laundry Terintegrasi</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', backgroundColor: 'var(--bg-card)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <Calendar size={14} />
            <span>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {currentTime.toLocaleTimeString('id-ID', { timeStyle: 'medium' })}
            </span>
          </div>
        </header>

        {/* ACTIVE TAB RENDER */}
        <div className="tab-content">
          {activeTab === 'dashboard' && (
            <Dashboard userProfile={userProfile} setTab={setActiveTab} />
          )}
          {activeTab === 'transactions' && (
            <Transactions userProfile={userProfile} />
          )}
          {activeTab === 'customers' && (
            <Customers />
          )}
          {activeTab === 'prices' && (
            <PriceSettings userProfile={userProfile} />
          )}
        </div>
      </main>
    </div>
  );
}
