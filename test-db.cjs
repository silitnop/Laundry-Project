const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const envText = fs.readFileSync('.env', 'utf8');
  const urlMatch = envText.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
  const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);

  const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
  const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

  console.log('Menghubungkan ke Supabase URL:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  async function test() {
    console.log('Mengecek tabel price_list...');
    const { data: prices, error: errPrices } = await supabase.from('price_list').select('*');
    if (errPrices) {
      console.error('Error saat membaca tabel price_list:', errPrices.message || errPrices);
    } else {
      console.log('Sukses! Tabel price_list terbaca. Jumlah data:', prices.length);
      console.log('Isi Data:', prices);
    }

    console.log('Mengecek tabel profiles...');
    const { data: profiles, error: errProfiles } = await supabase.from('profiles').select('*').limit(1);
    if (errProfiles) {
      console.error('Error saat membaca tabel profiles:', errProfiles.message || errProfiles);
    } else {
      console.log('Sukses! Tabel profiles terbaca.');
    }
  }

  test();
} catch (e) {
  console.error('Gagal menjalankan pengujian database:', e.message);
}
