import { formatRupiah, getServiceLabel, getPackageLabel, getCustomerTierShortLabel } from './pricing.js';

const getPaymentStatusLabel = (status) => {
  return status === 'lunas' ? 'LUNAS' : 'BELUM LUNAS';
};

// Generates ESC/POS bytes for 58mm printer (32 characters per line)
const generateEscPosBytes = (tx) => {
  const encoder = new TextEncoder();
  const concatArrays = (arrays) => {
    const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  };

  // ESC/POS Commands
  const INIT = new Uint8Array([0x1b, 0x40]);
  const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
  const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
  const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
  const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
  const DOUBLE_SIZE = new Uint8Array([0x1d, 0x21, 0x11]); // Double height and width
  const NORMAL_SIZE = new Uint8Array([0x1d, 0x21, 0x00]);
  const FEED_PAPER = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a]); // 4 line feeds
  const CUT_PAPER = new Uint8Array([0x1d, 0x56, 0x42, 0x00]); // Cut

  const dateStr = new Date(tx.created_at).toLocaleDateString('id-ID', {
    dateStyle: 'short',
  }) + ' ' + new Date(tx.created_at).toLocaleTimeString('id-ID', { timeStyle: 'short' });

  const estStr = new Date(tx.estimated_completed_at).toLocaleDateString('id-ID', {
    dateStyle: 'medium',
  });

  const parts = [
    INIT,
    ALIGN_CENTER,
    BOLD_ON,
    DOUBLE_SIZE,
    encoder.encode('Berkah Laundry\n'),
    NORMAL_SIZE,
    encoder.encode('Bersih, Rapi, Wangi\n'),
    encoder.encode('Jl. Masjid Darussalam No.66\n'),
    encoder.encode('RT.007/RW.04, Kedaung, Pamulang\n'),
    encoder.encode('Tangsel, Banten 15415\n'),
    encoder.encode('Telp: 0817-6908-709\n'),
    BOLD_OFF,
    encoder.encode('================================\n'), // 32 chars
    ALIGN_LEFT,
    encoder.encode(`No. Resi : ${tx.receipt_number}\n`),
    encoder.encode(`Tanggal  : ${dateStr}\n`),
    encoder.encode(`Kasir    : ${tx.profiles?.name || 'Kasir'}\n`),
    encoder.encode('--------------------------------\n'),
    encoder.encode(`Pelanggan: ${tx.customers?.name || 'Umum'}\n`),
    encoder.encode(`Telp     : ${tx.customers?.phone || '-'}\n`),
    encoder.encode(`Alamat   : ${tx.customers?.address || '-'}\n`),
    encoder.encode('--------------------------------\n'),
    BOLD_ON,
    encoder.encode(`Layanan  : ${getServiceLabel(tx.service)}\n`),
    encoder.encode(`Paket    : ${getPackageLabel(tx.package)}\n`),
    BOLD_OFF,
    encoder.encode('--------------------------------\n'),
  ];

  if (tx.price_mode === 'per_kg') {
    const weightStr = `${Number(tx.weight).toFixed(2)} kg`;
    const priceStr = formatRupiah(tx.unit_price);
    parts.push(
      encoder.encode(`Berat    : ${weightStr}\n`),
      encoder.encode(`Harga/kg : ${priceStr}\n`)
    );
  } else {
    parts.push(
      encoder.encode('Mode     : Satuan / Item\n'),
      encoder.encode(`Detail   : ${tx.item_details || '-'}\n`)
    );
  }

  parts.push(
    encoder.encode('================================\n'),
    ALIGN_CENTER,
    BOLD_ON,
    DOUBLE_SIZE,
    encoder.encode(`TOTAL: ${formatRupiah(tx.total_price)}\n`),
    NORMAL_SIZE,
    encoder.encode(`[ ${getPaymentStatusLabel(tx.payment_status)} ]\n`),
    BOLD_OFF,
    ALIGN_LEFT,
    encoder.encode('================================\n'),
    encoder.encode(`Estimasi Selesai:\n${estStr}\n`),
    encoder.encode('--------------------------------\n'),
    ALIGN_CENTER,
    encoder.encode('Terima kasih atas kepercayaan\n'),
    encoder.encode('Anda. Cucian bersih, hati senang!\n'),
    encoder.encode('Syarat & Ketentuan berlaku.\n'),
    FEED_PAPER,
    CUT_PAPER
  );

  return concatArrays(parts);
};

// Write byte buffer in 20-byte chunks to prevent BLE buffer overflow
const writeBleChunks = async (characteristic, data) => {
  const CHUNK_SIZE = 20;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await characteristic.writeValue(chunk);
    await new Promise((resolve) => setTimeout(resolve, 35)); // 35ms delay between chunks
  }
};

export const printToBluetooth = async (transaction) => {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome di desktop atau Android.');
  }

  try {
    // Standard Bluetooth printer services (18f0 is general for thermal printers)
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'PT-' },
        { namePrefix: 'Printer' },
        { namePrefix: 'MTP' },
        { namePrefix: 'RPP' }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000e7e1-0000-1000-8000-00805f9b34fb' // alternative write service
      ]
    });

    const server = await device.gatt.connect();

    // Attempt standard service UUID first, fall back to known services if needed
    let service;
    try {
      service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    } catch (e) {
      // Fallback service
      const services = await server.getPrimaryServices();
      if (services.length > 0) {
        service = services[0];
      } else {
        throw new Error('Tidak dapat menemukan service BLE yang kompatibel di printer ini.');
      }
    }

    const characteristics = await service.getCharacteristics();
    // Look for write characteristics
    const writeCharacteristic = characteristics.find(
      (c) => c.properties.write || c.properties.writeWithoutResponse
    );

    if (!writeCharacteristic) {
      throw new Error('Tidak dapat menemukan karakteristik penulisan (write characteristic) pada printer.');
    }

    const dataBytes = generateEscPosBytes(transaction);
    await writeBleChunks(writeCharacteristic, dataBytes);

    // Disconnect safely
    device.gatt.disconnect();
    return true;
  } catch (err) {
    console.error('Bluetooth printing error:', err);
    throw err;
  }
};

// Generates printable HTML fallback that simulates a 58mm thermal receipt paper
export const printToHTML = (transaction) => {
  const dateStr = new Date(transaction.created_at).toLocaleDateString('id-ID', {
    dateStyle: 'short',
  }) + ' ' + new Date(transaction.created_at).toLocaleTimeString('id-ID', { timeStyle: 'short' });

  const estStr = new Date(transaction.estimated_completed_at).toLocaleDateString('id-ID', {
    dateStyle: 'medium',
  });

  // Create a hidden printing iframe
  let iframe = document.getElementById('laundry-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'laundry-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Resi ${transaction.receipt_number}</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 58mm;
          margin: 0;
          padding: 5px;
          background-color: #fff;
          color: #000;
          font-size: 11px;
          line-height: 1.3;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .title { font-size: 15px; margin-bottom: 2px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .total-box {
          border: 1px solid #000;
          padding: 6px;
          text-align: center;
          margin: 8px 0;
          font-size: 12px;
        }
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <span class="bold title">Berkah Laundry</span><br/>
        <span>Bersih, Rapi, Wangi</span><br/>
        <span style="font-size: 9px; line-height: 1.2; display: block; margin: 2px 0;">
          Jl. Masjid Darussalam parkos No.66, RT.007/RW.04, Kedaung, Kec. Pamulang, Kota Tangerang Selatan, Banten 15415
        </span>
        <span>Telp: 0817-6908-709</span>
      </div>
      
      <div class="divider"></div>
      
      <div>
        <strong>No. Resi :</strong> ${transaction.receipt_number}<br/>
        <strong>Tanggal  :</strong> ${dateStr}<br/>
        <strong>Kasir    :</strong> ${transaction.profiles?.name || 'Kasir'}<br/>
      </div>
      
      <div class="divider"></div>
      
      <div>
        <strong>Pelanggan:</strong> ${transaction.customers?.name || 'Umum'}<br/>
        <strong>Telp     :</strong> ${transaction.customers?.phone || '-'}<br/>
        <strong>Alamat   :</strong> ${transaction.customers?.address || '-'}<br/>
      </div>
      
      <div class="divider"></div>
      
      <div class="bold">
        Layanan  : ${getServiceLabel(transaction.service)}<br/>
        Paket    : ${getPackageLabel(transaction.package)}<br/>
      </div>
      
      <div class="divider"></div>
      
      ${transaction.price_mode === 'per_kg' ? `
        <div class="row">
          <span>Berat:</span>
          <span>${Number(transaction.weight).toFixed(2)} kg</span>
        </div>
        <div class="row">
          <span>Harga/kg:</span>
          <span>${formatRupiah(transaction.unit_price)}</span>
        </div>
      ` : `
        <div><strong>Detail Satuan:</strong></div>
        <div style="padding-left: 5px; font-style: italic;">
          ${transaction.item_details || '-'}
        </div>
      `}
      
      <div class="divider"></div>
      
      <div class="total-box">
        <span class="bold">TOTAL: ${formatRupiah(transaction.total_price)}</span><br/>
        <span class="bold">[ ${getPaymentStatusLabel(transaction.payment_status)} ]</span>
      </div>
      
      <div class="divider"></div>
      
      <div>
        <strong>Estimasi Selesai:</strong><br/>
        ${estStr}
      </div>
      
      <div class="divider"></div>
      
      <div class="text-center" style="margin-top: 10px; font-size: 10px;">
        Terima kasih atas kepercayaan Anda.<br/>
        Cucian bersih, hati senang!<br/>
        Syarat & Ketentuan berlaku.
      </div>
    </body>
    </html>
  `;

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Trigger print after iframe content loads
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 500);
};
