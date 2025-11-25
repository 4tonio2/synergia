import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[SUPABASE] Configuration:', {
  url: supabaseUrl ? '✅ Défini' : '❌ Manquant',
  key: supabaseAnonKey ? '✅ Défini' : '❌ Manquant',
  urlValue: supabaseUrl,
});

if (!supabaseUrl || !supabaseAnonKey) {
  const error = 'Missing Supabase environment variables. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel dashboard!';
  console.error('[SUPABASE]', error);
  throw new Error(error);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

