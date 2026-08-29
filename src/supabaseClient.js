import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean up Supabase URL if it contains trailing slash or path suffix by mistake
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/+$/, '');
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '').replace(/\/auth\/v1$/, '');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Initialize Supabase Client. If missing, use placeholder so the app loads but shows warning.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-laundry.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Helper function to check if Supabase has been properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder-laundry'));
};
