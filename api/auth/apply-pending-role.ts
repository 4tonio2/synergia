import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCorsOptions } from '../_helpers';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const { medicalRole } = req.body;

    if (!medicalRole) {
      return res.status(400).json({ error: 'Medical role is required' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Verify user with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Update user role in database
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const sql = neon(databaseUrl);
    
    // Check if user exists
    const existingUser = await sql`
      SELECT id FROM "User" WHERE id = ${user.id}
    `;

    if (existingUser.length === 0) {
      // Create new user
      await sql`
        INSERT INTO "User" (id, email, "medicalRole", "firstName", "lastName")
        VALUES (
          ${user.id},
          ${user.email},
          ${medicalRole},
          ${user.user_metadata?.first_name || user.email?.split('@')[0] || 'User'},
          ${user.user_metadata?.last_name || ''}
        )
      `;
    } else {
      // Update existing user
      await sql`
        UPDATE "User"
        SET "medicalRole" = ${medicalRole}
        WHERE id = ${user.id}
      `;
    }

    res.status(200).json({ 
      success: true,
      message: 'Medical role applied successfully' 
    });

  } catch (error: any) {
    console.error('[AUTH] Apply role error:', error);
    res.status(500).json({ error: error.message });
  }
}
