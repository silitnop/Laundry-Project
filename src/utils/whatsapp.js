// Utility for Berkah Laundry WhatsApp notifications and templates.
import { formatRupiah, getServiceLabel, getPackageLabel } from './pricing.js';

/**
 * Normalizes phone numbers to standard WhatsApp format (628xxxxxxxx)
 * Handles: 0812..., +62812..., 62812..., 0812-3456-7890, etc.
 */
export const formatWhatsAppPhone = (phone) => {
  if (!phone) return '';
  // Remove all non-digit characters except '+'
  let cleaned = String(phone).replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
};

/**
 * Available WhatsApp message templates
 */
export const WA_TEMPLATES = [
  {
    id: 'cucian_selesai',
    name: 'Cucian Selesai (Siap Diambil)',
    icon: '✨',
    generate: (tx) => {
      const customerName = tx.customers?.name || 'Pelanggan';
      const receiptNo = tx.receipt_number;
      const serviceName = getServiceLabel(tx.service);
      const packageName = getPackageLabel(tx.package);
      const isLunas = tx.payment_status === 'lunas';
      const weightOrItem = tx.price_mode === 'per_kg'
        ? `${Number(tx.weight || 0).toFixed(2)} kg`
        : (tx.item_details || 'Item Satuan');
      const totalStr = formatRupiah(tx.total_price);

      return (
        `Halo Kak ${customerName}! 👋

Pemberitahuan dari Berkah Laundry:
Cucian Anda sudah SELESAI dan siap diambil atau diantar! ✨

📋 Rincian Cucian:
• No. Resi: ${receiptNo}
• Layanan: ${serviceName} (${packageName})
• Jumlah: ${weightOrItem}
• Total Biaya: ${totalStr}
• Status Bayar: ${isLunas ? '✅ LUNAS' : '⏳ BELUM LUNAS'}

${!isLunas ? `👉 Catatan Pembayaran: Mohon siapkan pembayaran sebesar ${totalStr} saat pengambilan cucian.\n\n` : ''}📍 Lokasi Berkah Laundry:
Jl. Masjid Darussalam parkos No.66, RT.007/RW.04, Kedaung, Kec. Pamulang, Kota Tangerang Selatan, Banten 15415
Hubungi: 0817-6908-709

Terima kasih atas kepercayaannya mencuci di Berkah Laundry! 🙏`
      );
    },
  },
  {
    id: 'pengingat_ambil',
    name: 'Pengingat Pengambilan Cucian',
    icon: '⏰',
    generate: (tx) => {
      const customerName = tx.customers?.name || 'Pelanggan';
      const receiptNo = tx.receipt_number;
      const isLunas = tx.payment_status === 'lunas';
      const totalStr = formatRupiah(tx.total_price);

      return (
        `Halo Kak ${customerName}! 👋

Mengingatkan kembali bahwa cucian Anda dengan No. Resi ${receiptNo} di Berkah Laundry sudah selesai dan siap diambil. 🧺✨

${!isLunas ? `• Tagihan: ${totalStr} (Belum Lunas)\n` : '• Status: LUNAS\n'}
Silakan mampir ke toko kami di Jl. Masjid Darussalam parkos No.66, RT.007/RW.04, Kedaung, Kec. Pamulang, Kota Tangerang Selatan, Banten 15415 pada jam operasional. 

Jika butuh layanan antar, silakan balas pesan ini ya Kak. Terima kasih! 🙏`
      );
    },
  },
  {
    id: 'konfirmasi_nota',
    name: 'Konfirmasi Penerimaan Cucian (Nota Masuk)',
    icon: '📝',
    generate: (tx) => {
      const customerName = tx.customers?.name || 'Pelanggan';
      const receiptNo = tx.receipt_number;
      const serviceName = getServiceLabel(tx.service);
      const packageName = getPackageLabel(tx.package);
      const weightOrItem = tx.price_mode === 'per_kg'
        ? `${Number(tx.weight || 0).toFixed(2)} kg`
        : (tx.item_details || 'Item Satuan');
      const totalStr = formatRupiah(tx.total_price);
      const isLunas = tx.payment_status === 'lunas';
      const estStr = tx.estimated_completed_at
        ? new Date(tx.estimated_completed_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'Sesuai estimasi';

      return (
        `Halo Kak ${customerName}! 👋

Terima kasih telah mempercayakan cucian Anda di Berkah Laundry. Berikut adalah bukti nota transaksi masuk:

🧾 Nota Transaksi:
• No. Resi: ${receiptNo}
• Layanan: ${serviceName} (${packageName})
• Jumlah: ${weightOrItem}
• Estimasi Selesai: ${estStr}
• Total Biaya: ${totalStr}
• Status: ${isLunas ? '✅ LUNAS' : '⏳ BELUM LUNAS'}

Kami akan segera memberitahu Anda kembali begitu cucian selesai diproses. Bersih, Rapi, Wangi! ✨`
      );
    },
  },
];

/**
 * Builds the direct WhatsApp API link (avoids wa.me redirect Latin-1 charset bug that corrupts emojis into )
 */
export const createWhatsAppUrl = (phone, message) => {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  if (!formattedPhone) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
};

/**
 * Opens WhatsApp in a new tab/window
 */
export const openWhatsApp = (phone, message) => {
  const url = createWhatsAppUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
};
