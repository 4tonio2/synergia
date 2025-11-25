import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCorsOptions } from '../_helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AUTH] Logout error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ message: 'Logged out successfully' });

  } catch (error: any) {
    console.error('[AUTH] Logout error:', error);
    res.status(500).json({ error: error.message });
  }
}
