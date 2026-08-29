import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, MapPin, Camera, User, Phone, Home, FileText, CheckCircle, ShieldAlert, Edit2, Map, Plus } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon Paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map Picker component (Vanilla Leaflet wrapper)
function MapPicker({ lat, lng, onChange }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  useEffect(() => {
    const startLat = lat || -6.200000;
    const startLng = lng || 106.816666;

    if (!mapInstanceRef.current && mapContainerRef.current) {
      // Initialize map
      const map = L.map(mapContainerRef.current).setView([startLat, startLng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add draggable marker
      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onChange(position.lat, position.lng);
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
    } else if (mapInstanceRef.current && markerInstanceRef.current) {
      if (lat && lng) {
        markerInstanceRef.current.setLatLng([lat, lng]);
        // Only set view if coordinates are different
        const currentCenter = mapInstanceRef.current.getCenter();
        if (Math.abs(currentCenter.lat - lat) > 0.001 || Math.abs(currentCenter.lng - lng) > 0.001) {
          mapInstanceRef.current.setView([lat, lng], 14);
        }
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, [lat, lng, onChange]);

  return <div ref={mapContainerRef} className="map-picker-container" />;
}

// Client-side image compression
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          },
          'image/jpeg',
          0.7 // quality setting
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locDescription, setLocDescription] = useState('');
  const [latitude, setLatitude] = useState(-6.200000);
  const [longitude, setLongitude] = useState(106.816666);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('customers').select('*');
      
      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setErrorMsg('Gagal memuat daftar pelanggan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const handleOpenAdd = () => {
    setSelectedId(null);
    setName('');
    setPhone('');
    setAddress('');
    setLocDescription('');
    // Try to get current position for map initial center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
      }, () => {
        setLatitude(-6.200000);
        setLongitude(106.816666);
      });
    } else {
      setLatitude(-6.200000);
      setLongitude(106.816666);
    }
    setImageFile(null);
    setImagePreview('');
    setExistingImageUrl('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (customer) => {
    setSelectedId(customer.id);
    setName(customer.name);
    setPhone(customer.phone || '');
    setAddress(customer.address);
    setLocDescription(customer.location_description || '');
    setLatitude(customer.latitude || -6.200000);
    setLongitude(customer.longitude || 106.816666);
    setImageFile(null);
    setImagePreview('');
    setExistingImageUrl(customer.foto_rumah_url || '');
    setErrorMsg('');
    setSuccessMsg('');
    setShowModal(true);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      // Compression
      const compressed = await compressImage(file);
      setImageFile(compressed);
      
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.error('Image compression failed:', err);
      setErrorMsg('Gagal mengompresi gambar. Coba gambar lain.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setUploadingImage(true);

    try {
      let finalImageUrl = existingImageUrl;

      // Handle Image Upload to Supabase Storage
      if (imageFile) {
        const fileExt = 'jpg'; // We compress to JPEG format
        const fileName = `${Date.now()}_house.${fileExt}`;
        const filePath = `customers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('foto-rumah')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw new Error('Gagal upload gambar. Pastikan bucket "foto-rumah" sudah dibuat di Supabase Storage Anda.');
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('foto-rumah')
          .getPublicUrl(filePath);

        finalImageUrl = urlData.publicUrl;
      }

      const customerPayload = {
        name,
        phone,
        address,
        location_description: locDescription,
        latitude,
        longitude,
        foto_rumah_url: finalImageUrl,
      };

      if (selectedId) {
        // Edit Customer
        const { error } = await supabase
          .from('customers')
          .update(customerPayload)
          .eq('id', selectedId);

        if (error) throw error;
        setSuccessMsg(`Pelanggan ${name} berhasil diperbarui.`);
      } else {
        // Create Customer
        const { error } = await supabase
          .from('customers')
          .insert([customerPayload]);

        if (error) throw error;
        setSuccessMsg(`Pelanggan ${name} berhasil ditambahkan.`);
      }

      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      console.error('Error saving customer:', err);
      setErrorMsg(err.message || 'Gagal menyimpan data pelanggan.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Data Pelanggan</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Kelola data alamat, ciri patokan, foto rumah, dan koordinat maps pelanggan.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Tambah Pelanggan
        </button>
      </div>

      {/* Search Input */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '38px' }}
            placeholder="Cari pelanggan berdasarkan nama, nomor telepon, atau alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

      {/* Customers List Card */}
      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat data pelanggan...</p>
        ) : customers.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Tidak ada data pelanggan ditemukan.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nama</th>
                  <th>Telepon</th>
                  <th>Alamat</th>
                  <th>Patokan / Detail</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.foto_rumah_url ? (
                        <img
                          src={c.foto_rumah_url}
                          alt={`Rumah ${c.name}`}
                          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                        />
                      ) : (
                        <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyCentert: 'center', color: 'var(--text-muted)' }}>
                          <Home size={18} style={{ margin: 'auto' }} />
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '600' }}>{c.name}</td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.address}</td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.location_description || '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Edit2 size={12} /> Ubah
                        </button>
                        {c.latitude && c.longitude && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                          >
                            <MapPin size={12} /> Peta
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>{selectedId ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama Pelanggan <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      style={{ paddingLeft: '35px' }}
                      placeholder="Contoh: Budi Santoso"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nomor Telepon</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      style={{ paddingLeft: '35px' }}
                      placeholder="Contoh: 081234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Home size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '35px' }}
                    placeholder="Contoh: Jl. Merdeka No. 45, RT 02/05"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Patokan Rumah / Ciri-Ciri Fisik</label>
                <div style={{ position: 'relative' }}>
                  <FileText size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '35px' }}
                    placeholder="Contoh: Cat rumah hijau, pagar hitam, samping masjid Al-Ikhlas"
                    value={locDescription}
                    onChange={(e) => setLocDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Photo Upload Container */}
              <div className="form-group">
                <label className="form-label">Foto Rumah Pelanggan</label>
                <div className="photo-upload-container">
                  {(imagePreview || existingImageUrl) ? (
                    <img
                      src={imagePreview || existingImageUrl}
                      alt="Preview Foto Rumah"
                      className="photo-preview"
                    />
                  ) : (
                    <div className="photo-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <Camera size={24} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <input
                      type="file"
                      id="foto-rumah"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                    <label htmlFor="foto-rumah" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Pilih Gambar
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Maks. 5MB. Otomatis dikompresi &lt; 300KB
                    </span>
                  </div>
                </div>
              </div>

              {/* Leaflet Map Picker */}
              <div className="form-group">
                <label className="form-label">Titik Lokasi Maps</label>
                <div className="map-marker-hint">
                  Geser pin merah atau klik pada peta untuk menyesuaikan titik koordinat rumah secara presisi.
                </div>
                <MapPicker
                  lat={latitude}
                  lng={longitude}
                  onChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Latitude: {latitude.toFixed(6)}</span>
                  <span>Longitude: {longitude.toFixed(6)}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={uploadingImage}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploadingImage}
                >
                  {uploadingImage ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
