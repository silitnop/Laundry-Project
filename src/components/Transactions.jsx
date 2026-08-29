import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { printToBluetooth, printToHTML } from '../utils/printReceipt';
import { Search, Plus, Filter, Calendar, Printer, RefreshCw, CheckCircle, ShieldAlert, FileText, ChevronRight, Check, MapPin, UserPlus } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Transactions({ userProfile }) {
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [priceList, setPriceList] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // New Transaction Form state
  const [customerId, setCustomerId] = useState('');
  const [service, setService] = useState('reguler');
  const [pkg, setPkg] = useState('cuci_setrika');
  const [priceMode, setPriceMode] = useState('per_kg');
  const [weight, setWeight] = useState('');
  const [itemDetails, setItemDetails] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('belum_lunas');
  
  // Quick Customer Creation inline
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [qcName, setQcName] = useState('');
  const [qcPhone, setQcPhone] = useState('');
  const [qcAddress, setQcAddress] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all transactions, customers and price list
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Price List
      const { data: prices, error: pricesErr } = await supabase.from('price_list').select('*');
      if (pricesErr) throw pricesErr;
      
      const priceMap = {};
      prices.forEach(p => {
        priceMap[p.service] = p;
      });
      setPriceList(priceMap);

      // 2. Fetch Customers
      const { data: custs, error: custsErr } = await supabase
        .from('customers')
        .select('id, name, phone, address')
        .order('name');
      if (custsErr) throw custsErr;
      setCustomers(custs || []);

      // 3. Fetch Transactions
      let query = supabase
        .from('transactions')
        .select(`
          *,
          customers ( id, name, phone, address, location_description, latitude, longitude, foto_rumah_url ),
          profiles ( id, name )
        `);

      if (searchQuery.trim()) {
        query = query.or(`receipt_number.ilike.%${searchQuery}%, customers.name.ilike.%${searchQuery}%`);
      }
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      if (filterPayment) {
        query = query.eq('payment_status', filterPayment);
      }
      if (filterService) {
        query = query.eq('service', filterService);
      }
      if (filterDate) {
        query = query.gte('created_at', `${filterDate}T00:00:00.000Z`)
                     .lte('created_at', `${filterDate}T23:59:59.999Z`);
      }

      const { data: txs, error: txsErr } = await query.order('created_at', { ascending: false });
      if (txsErr) throw txsErr;
      setTransactions(txs || []);

    } catch (err) {
      console.error('Error fetching transactions data:', err);
      setErrorMsg('Gagal memuat data transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, filterStatus, filterPayment, filterService, filterDate]);

  // Recalculate price when inputs change
  useEffect(() => {
    if (priceMode === 'per_kg') {
      const basePrice = priceList[service]?.price_per_kg || 0;
      setUnitPrice(basePrice);
      const computedTotal = Number(weight || 0) * basePrice;
      setTotalPrice(computedTotal);
    } else {
      // For per_satuan, unitPrice is editable and equals totalPrice
      setTotalPrice(Number(unitPrice || 0));
    }
  }, [service, priceMode, weight, unitPrice, priceList]);

  const handleOpenAdd = () => {
    setCustomerId('');
    setService('reguler');
    setPkg('cuci_setrika');
    setPriceMode('per_kg');
    setWeight('');
    setItemDetails('');
    setPaymentStatus('belum_lunas');
    setShowQuickCustomer(false);
    setErrorMsg('');
    setSuccessMsg('');
    setShowAddModal(true);
  };

  const handleQuickCustomerCreate = async (e) => {
    e.preventDefault();
    if (!qcName || !qcAddress) {
      setErrorMsg('Nama dan Alamat wajib diisi.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name: qcName, phone: qcPhone, address: qcAddress }])
        .select();

      if (error) throw error;
      
      if (data && data[0]) {
        // Add to list and select
        setCustomers([data[0], ...customers]);
        setCustomerId(data[0].id);
        setShowQuickCustomer(false);
        setQcName('');
        setQcPhone('');
        setQcAddress('');
        setSuccessMsg(`Pelanggan baru ${data[0].name} berhasil dibuat.`);
      }
    } catch (err) {
      console.error('Quick customer failed:', err);
      setErrorMsg('Gagal membuat pelanggan cepat.');
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg('Harap pilih pelanggan terlebih dahulu.');
      return;
    }
    if (priceMode === 'per_kg' && (!weight || Number(weight) <= 0)) {
      setErrorMsg('Berat cucian harus lebih besar dari 0 kg.');
      return;
    }
    if (priceMode === 'per_satuan' && (!unitPrice || Number(unitPrice) <= 0)) {
      setErrorMsg('Harga satuan harus lebih besar dari Rp 0.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Calculate estimated completion date
      const estDays = priceList[service]?.estimation_days || 0;
      const completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + estDays);

      const payload = {
        customer_id: customerId,
        kasir_id: userProfile.id,
        service,
        package: pkg,
        price_mode: priceMode,
        weight: priceMode === 'per_kg' ? Number(weight) : null,
        item_details: priceMode === 'per_satuan' ? itemDetails : null,
        unit_price: Number(unitPrice),
        total_price: Number(totalPrice),
        payment_status: paymentStatus,
        status: 'belum_diproses',
        estimated_completed_at: completionDate.toISOString(),
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select(`
          *,
          customers ( id, name, phone, address ),
          profiles ( id, name )
        `);

      if (error) throw error;

      if (data && data[0]) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        setSuccessMsg(`Transaksi ${data[0].receipt_number} berhasil dibuat!`);
        setShowAddModal(false);
        // Show success alert and open details of created transaction
        setSelectedTx(data[0]);
        setShowDetailModal(true);
        fetchData();
      }

    } catch (err) {
      console.error('Error saving transaction:', err);
      setErrorMsg(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (txId, newStatus) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', txId);

      if (error) throw error;
      
      setSuccessMsg('Status transaksi berhasil diubah.');
      
      // Update local state to avoid full reload
      setTransactions(transactions.map(t => t.id === txId ? { ...t, status: newStatus } : t));
      if (selectedTx && selectedTx.id === txId) {
        setSelectedTx({ ...selectedTx, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setErrorMsg('Gagal mengubah status transaksi.');
    }
  };

  const handleUpdatePayment = async (txId, newPayment) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ payment_status: newPayment })
        .eq('id', txId);

      if (error) throw error;

      setSuccessMsg('Status pembayaran berhasil diubah.');
      setTransactions(transactions.map(t => t.id === txId ? { ...t, payment_status: newPayment } : t));
      if (selectedTx && selectedTx.id === txId) {
        setSelectedTx({ ...selectedTx, payment_status: newPayment });
      }
    } catch (err) {
      console.error('Error updating payment:', err);
      setErrorMsg('Gagal mengubah status pembayaran.');
    }
  };

  const handlePrintBT = async (tx) => {
    setErrorMsg('');
    try {
      await printToBluetooth(tx);
      setSuccessMsg(`Resi ${tx.receipt_number} dikirim ke printer bluetooth.`);
    } catch (err) {
      console.error('Print bluetooth error:', err);
      setErrorMsg(`Pencetakan bluetooth gagal: ${err.message || err}. Membuka preview cetak browser...`);
      // Trigger HTML fallback print automatically
      printToHTML(tx);
    }
  };

  const handlePrintHTML = (tx) => {
    printToHTML(tx);
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getServiceLabel = (srv) => {
    switch (srv) {
      case 'reguler': return 'Reguler';
      case 'express': return 'Express';
      case 'express_kilat': return 'Express Kilat';
      default: return srv;
    }
  };

  const getPackageLabel = (p) => {
    switch (p) {
      case 'cuci_setrika': return 'Cuci Setrika';
      case 'cuci_lipat': return 'Cuci Lipat';
      case 'setrika_saja': return 'Setrika Saja';
      case 'cuci_saja': return 'Cuci Saja';
      default: return p;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Riwayat Transaksi</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Mencatat transaksi masuk, mengupdate status pengerjaan, dan mencetak resi kasir.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Transaksi Baru
        </button>
      </div>

      {/* Filters & Search Row */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem' }} className="grid-cols-1-3">
          <div style={{ gridColumn: 'span 2', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '38px' }}
              placeholder="Cari transaksi berdasarkan No. Resi atau nama pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="date"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua Status Cucian</option>
            <option value="belum_diproses">Belum Diproses</option>
            <option value="diproses">Sedang Diproses</option>
            <option value="selesai">Selesai</option>
            <option value="sudah_diambil">Sudah Diambil</option>
          </select>

          <select className="form-control" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
            <option value="">Semua Status Pembayaran</option>
            <option value="belum_lunas">Belum Lunas</option>
            <option value="lunas">Lunas</option>
          </select>

          <select className="form-control" value={filterService} onChange={(e) => setFilterService(e.target.value)}>
            <option value="">Semua Jenis Layanan</option>
            <option value="reguler">Reguler</option>
            <option value="express">Express</option>
            <option value="express_kilat">Express Kilat</option>
          </select>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('');
              setFilterPayment('');
              setFilterService('');
              setFilterDate('');
            }}
          >
            Reset Filter
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert-banner alert-banner-success">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-banner alert-banner-error">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transactions Table Card */}
      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat data transaksi...</p>
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Tidak ada transaksi yang cocok.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Resi</th>
                  <th>Tanggal</th>
                  <th>Pelanggan</th>
                  <th>Layanan</th>
                  <th>Paket</th>
                  <th>Total Harga</th>
                  <th>Pengerjaan</th>
                  <th>Pembayaran</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td
                      style={{ fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedTx(tx);
                        setShowDetailModal(true);
                      }}
                    >
                      {tx.receipt_number}
                    </td>
                    <td>
                      {new Date(tx.created_at).toLocaleDateString('id-ID', { dateStyle: 'short' })}
                    </td>
                    <td>{tx.customers?.name || 'Umum'}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <span className="badge badge-primary">{getServiceLabel(tx.service)}</span>
                    </td>
                    <td>{getPackageLabel(tx.package)}</td>
                    <td style={{ fontWeight: '600' }}>{formatRupiah(tx.total_price)}</td>
                    <td>
                      {tx.status === 'belum_diproses' && <span className="badge badge-danger">Belum Diproses</span>}
                      {tx.status === 'diproses' && <span className="badge badge-warning">Diproses</span>}
                      {tx.status === 'selesai' && <span className="badge badge-success">Selesai</span>}
                      {tx.status === 'sudah_diambil' && <span className="badge badge-primary">Sudah Diambil</span>}
                    </td>
                    <td>
                      <span className={`badge ${tx.payment_status === 'lunas' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            setSelectedTx(tx);
                            setShowDetailModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => handlePrintBT(tx)}
                          className="btn btn-secondary"
                          title="Cetak via Bluetooth Thermal"
                          style={{ padding: '0.3rem 0.5rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. NEW TRANSACTION MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Buat Transaksi Laundry Baru</h3>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowAddModal(false)}
              >
                &times;
              </button>
            </div>

            {showQuickCustomer ? (
              // Inline customer registration
              <form onSubmit={handleQuickCustomerCreate} style={{ padding: '1rem', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Tambah Pelanggan Cepat</h4>
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nama lengkap"
                    value={qcName}
                    onChange={(e) => setQcName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nomor HP</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="08xxxxxxxx"
                      value={qcPhone}
                      onChange={(e) => setQcPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alamat Lengkap *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Alamat pelanggan"
                      value={qcAddress}
                      onChange={(e) => setQcAddress(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setShowQuickCustomer(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                    Simpan & Pilih
                  </button>
                </div>
              </form>
            ) : null}

            <form onSubmit={handleSaveTransaction}>
              {/* Customer Select Row */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Pilih Pelanggan *</label>
                  {!showQuickCustomer && (
                    <button
                      type="button"
                      onClick={() => setShowQuickCustomer(true)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <UserPlus size={12} /> + Pelanggan Baru
                    </button>
                  )}
                </div>
                <select
                  className="form-control"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  disabled={showQuickCustomer}
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'tidak ada no telp'}) - {c.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service & Package */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jenis Layanan (Kecepatan)</label>
                  <select className="form-control" value={service} onChange={(e) => setService(e.target.value)}>
                    <option value="reguler">Reguler (3-4 Hari)</option>
                    <option value="express">Express (1 Hari)</option>
                    <option value="express_kilat">Express Kilat (Hari yang sama)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Paket Pengerjaan</label>
                  <select className="form-control" value={pkg} onChange={(e) => setPkg(e.target.value)}>
                    <option value="cuci_setrika">Cuci Setrika</option>
                    <option value="cuci_lipat">Cuci Lipat</option>
                    <option value="setrika_saja">Setrika Saja</option>
                    <option value="cuci_saja">Cuci Saja (Hanya Cuci)</option>
                  </select>
                </div>
              </div>

              {/* Mode Price */}
              <div className="form-group">
                <label className="form-label">Mode Penghitungan Harga</label>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="priceMode"
                      value="per_kg"
                      checked={priceMode === 'per_kg'}
                      onChange={() => setPriceMode('per_kg')}
                    />
                    Dihitung per kg
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="priceMode"
                      value="per_satuan"
                      checked={priceMode === 'per_satuan'}
                      onChange={() => setPriceMode('per_satuan')}
                    />
                    Dihitung per satuan/item
                  </label>
                </div>
              </div>

              {/* Weight or Satuan input */}
              {priceMode === 'per_kg' ? (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Berat Cucian (kg) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required={priceMode === 'per_kg'}
                      min={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Layanan per kg</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: 'bold' }}
                      value={formatRupiah(unitPrice)}
                      disabled
                    />
                  </div>
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Keterangan Item / Rincian Satuan *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: 1 Bedcover besar, 2 sepatu kulit"
                      value={itemDetails}
                      onChange={(e) => setItemDetails(e.target.value)}
                      required={priceMode === 'per_satuan'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Harga Item (Input Manual) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      value={unitPrice || ''}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      required={priceMode === 'per_satuan'}
                      min={1}
                    />
                  </div>
                </div>
              )}

              {/* Final Calculations & Payment */}
              <div className="card" style={{ backgroundColor: 'var(--primary-glow)', border: '1px solid hsl(var(--p-h) var(--p-s) var(--p-l) / 0.3)', padding: '1rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimasi Tanggal Selesai</span>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>
                      {(() => {
                        const estDays = priceList[service]?.estimation_days || 0;
                        const date = new Date();
                        date.setDate(date.getDate() + estDays);
                        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                      })()}
                    </h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Pembayaran</span>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: '800' }}>{formatRupiah(totalPrice)}</h3>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status Pembayaran</label>
                <select className="form-control" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                  <option value="belum_lunas">Belum Lunas (Bayar Belakangan)</option>
                  <option value="lunas">Lunas (Bayar Sekarang)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={saving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || showQuickCustomer}>
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. TRANSACTION DETAIL & CONTROL PANEL MODAL */}
      {showDetailModal && selectedTx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Detail Resi: {selectedTx.receipt_number}</h3>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowDetailModal(false)}
              >
                &times;
              </button>
            </div>

            {/* Printable Area Simulator */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="grid-cols-1-3">
                
                {/* General Laundry Info */}
                <div style={{ gridColumn: 'span 2' }}>
                  <h4 style={{ marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    Informasi Pengerjaan
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.85rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0', width: '120px' }}>Pelanggan:</td>
                        <td>{selectedTx.customers?.name || 'Umum'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Telepon:</td>
                        <td>{selectedTx.customers?.phone || '-'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Alamat:</td>
                        <td>{selectedTx.customers?.address || '-'}</td>
                      </tr>
                      {selectedTx.customers?.location_description && (
                        <tr>
                          <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Patokan Rumah:</td>
                          <td style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                            {selectedTx.customers.location_description}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Layanan / Paket:</td>
                        <td style={{ fontWeight: '600' }}>
                          {getServiceLabel(selectedTx.service)} ({getPackageLabel(selectedTx.package)})
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Tanggal Masuk:</td>
                        <td>{new Date(selectedTx.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Estimasi Selesai:</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                          {new Date(selectedTx.estimated_completed_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '600', padding: '0.25rem 0' }}>Kasir Melayani:</td>
                        <td>{selectedTx.profiles?.name || 'Kasir'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Photo & Map links if available */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedTx.customers?.foto_rumah_url ? (
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Foto Rumah</span>
                      <a href={selectedTx.customers.foto_rumah_url} target="_blank" rel="noreferrer">
                        <img
                          src={selectedTx.customers.foto_rumah_url}
                          alt="Foto Rumah"
                          style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                        />
                      </a>
                    </div>
                  ) : null}

                  {selectedTx.customers?.latitude && selectedTx.customers?.longitude ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedTx.customers.latitude},${selectedTx.customers.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                    >
                      <MapPin size={12} /> Buka Google Maps
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Price Calculations */}
              <div>
                <h4 style={{ marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                  Rincian Biaya
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span>
                    {selectedTx.price_mode === 'per_kg'
                      ? `Timbangan: ${Number(selectedTx.weight).toFixed(2)} kg @ ${formatRupiah(selectedTx.unit_price)}`
                      : `Detail Satuan: ${selectedTx.item_details || '-'}`}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{formatRupiah(selectedTx.total_price)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Status Pengerjaan</span>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <select
                        className="form-control"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '150px' }}
                        value={selectedTx.status}
                        onChange={(e) => handleUpdateStatus(selectedTx.id, e.target.value)}
                      >
                        <option value="belum_diproses">Belum Diproses</option>
                        <option value="diproses">Diproses</option>
                        <option value="selesai">Selesai</option>
                        <option value="sudah_diambil">Sudah Diambil</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Status Pembayaran</span>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
                      <select
                        className="form-control"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
                        value={selectedTx.payment_status}
                        onChange={(e) => handleUpdatePayment(selectedTx.id, e.target.value)}
                      >
                        <option value="belum_lunas">Belum Lunas</option>
                        <option value="lunas">Lunas</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions & Printing */}
              <div className="modal-footer" style={{ marginTop: '0.5rem', padding: '0.75rem 0 0' }}>
                <button
                  onClick={() => handlePrintHTML(selectedTx)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Printer size={16} /> Cetak (Browser / PDF)
                </button>
                <button
                  onClick={() => handlePrintBT(selectedTx)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Printer size={16} /> Cetak (Thermal Bluetooth)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
