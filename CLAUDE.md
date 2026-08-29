# CLAUDE.md — Aplikasi Kasir Laundry

Dokumen ini adalah panduan/spesifikasi proyek untuk Claude (atau developer lain) saat membangun aplikasi laundry ini.

## 1. Ringkasan Proyek
Aplikasi kasir **web app** untuk usaha laundry. Fungsi utama: mencatat transaksi pelanggan (dengan lokasi rumah lengkap foto & maps), mengelola jenis layanan & paket cucian, mencetak resi via **printer thermal bluetooth**, login multi-user (kasir), dan melihat riwayat transaksi.

## 2. Fitur Utama

### 2.1 Data Pelanggan
- Nama pelanggan
- Alamat / lokasi rumah pelanggan (teks)
- **Foto rumah** (upload gambar, untuk memudahkan kurir/kasir mengenali rumah)
- **Titik lokasi Maps** (koordinat lat/long atau link Google Maps — tampilkan pin di peta)
- **Deskripsi detail lokasi** (kolom teks bebas, misal patokan/ciri rumah: "cat hijau, dekat masjid, pagar hitam")
- (opsional: nomor telepon)

### 2.2 Login & User (Multi-user)
- Aplikasi **perlu login**, tidak single user.
- Role minimal:
  - **Admin/Owner** — kelola harga, lihat semua transaksi, kelola user kasir
  - **Kasir** — input transaksi, cetak resi, lihat transaksi milik sendiri/toko

### 2.3 Jenis Layanan (kecepatan proses)
| Layanan | Estimasi Selesai | Harga per kg |
|---|---|---|
| Reguler | 3–4 hari | *(belum diisi)* |
| Express (biasa) | 1 hari | *(belum diisi)* |
| Express Kilat | Selesai hari yang sama | *(belum diisi)* |

> 💡 **Harga sengaja dikosongkan dulu** — belum dikonfirmasi ke pihak terkait. Nominal akan diisi belakangan langsung di tabel `price_list` (lihat `schema.sql`), tanpa perlu ubah kode aplikasi. Estimasi waktu (3–4 hari / 1 hari / hari itu juga) sudah fix dan dimasukkan ke schema.

### 2.4 Paket / Metode Cucian
- Cuci Setrika
- Cuci Lipat
- Setrika Saja

> ⚠️ **Perlu dikonfirmasi:** sebelumnya juga disebutkan paket "Cuci saja" (tanpa lipat/setrika). Apakah paket ini masih tersedia di luar 3 paket di atas, atau sudah tidak dipakai?

### 2.5 Mode Hitung Harga
Ada 2 mode saat input transaksi:
1. **Per kg** — harga otomatis mengikuti tabel harga (lihat 2.3), tinggal input berat.
2. **Per satuan/item** — untuk barang yang tidak dihitung per kg (misal: selimut, bed cover, sepatu, dll). Kasir **input harga manual** langsung saat transaksi.

### 2.6 Transaksi
- Input transaksi baru: pilih/buat pelanggan → pilih jenis layanan (Reguler/Express/Express Kilat) → pilih paket cucian → pilih mode harga (per kg / per satuan) → input berat atau harga manual → total dihitung otomatis (kecuali mode manual).
- Sistem otomatis menghitung **estimasi tanggal selesai** berdasarkan jenis layanan.
- Lihat daftar/riwayat transaksi (bisa difilter per tanggal, pelanggan, status, kasir yang input).
- Ubah status transaksi (misal: Belum Diproses → Diproses → Selesai → Sudah Diambil).

### 2.7 Cetak Resi
- Resi dicetak ke **printer thermal via Bluetooth**.
- Kasir menggunakan **Chrome di Android** → kompatibel dengan Web Bluetooth API, tidak ada masalah kompatibilitas.
- Bisa cetak saat transaksi baru dibuat, dan cetak ulang dari riwayat transaksi.

## 3. Struktur Database
Database dibangun di **Supabase** (Postgres). Skema lengkap (tabel, enum, RLS policy, trigger nomor resi) ada di **`schema.sql`** — tinggal jalankan di SQL Editor Supabase.

Ringkasan tabel:
- `profiles` — data user (extend `auth.users` bawaan Supabase), simpan nama & role (admin/kasir)
- `customers` — data pelanggan + foto rumah + koordinat maps + deskripsi lokasi
- `price_list` — harga per jenis layanan (nominal masih kosong, tunggu konfirmasi)
- `transactions` — data transaksi, terhubung ke `customers` & `profiles`

## 4. Format Resi (Draft)
- Nama & alamat usaha laundry
- Nomor transaksi & tanggal
- Nama pelanggan & alamat
- Jenis layanan (Reguler/Express/Express Kilat) + estimasi selesai
- Jenis paket cucian
- Berat (kg) atau keterangan item, harga satuan, total
- Status pembayaran
- Nama kasir yang melayani

## 5. Pertanyaan Terbuka (masih perlu dikonfirmasi)
- [ ] Nominal harga per kg untuk Reguler/Express/Express Kilat (menunggu konfirmasi ke pihak terkait)
- [ ] Apakah paket "Cuci Saja" masih ada di luar 3 paket (Cuci Setrika, Cuci Lipat, Setrika Saja)?
- [ ] Format link/koordinat maps: pakai link Google Maps langsung atau input lat/long manual dari peta di app?
- [ ] Merk/tipe printer bluetooth thermal yang dipakai (untuk pastikan kompatibilitas ESC/POS & ukuran kertas 58mm/80mm)?

## 6. Catatan Teknis untuk Claude
- **Platform: Web App**, backend/database pakai **Supabase**.
- **Cetak Bluetooth:** kasir sudah dipastikan pakai **Chrome di Android** → Web Bluetooth API didukung penuh, tidak perlu workaround.
- Harga jangan di-hardcode — ambil dari tabel `price_list` (nominal masih kosong, isi belakangan lewat dashboard/admin panel Supabase) agar admin bisa ubah nominal tanpa ubah kode.
- Fitur cetak resi dipisah jadi fungsi tersendiri (`generateReceipt(transactionId)`) agar bisa dipanggil ulang dari riwayat transaksi.
- Foto rumah disimpan di **Supabase Storage** (bucket `foto-rumah`), field `foto_rumah_url` di tabel `customers` menyimpan path/URL-nya. Kompresi gambar di sisi klien sebelum upload agar hemat storage.
- Login pakai **Supabase Auth**; role admin/kasir disimpan di tabel `profiles`, dibedakan lewat RLS policy (lihat `schema.sql`) — admin bisa ubah harga, kasir tidak.
