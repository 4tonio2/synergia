import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCorsOptions } from './_helpers';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================
// Action Handlers
// ============================================================

async function handleLogin(req: VercelRequest, res: VercelResponse) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('[AUTH] Login error:', error);
        return res.status(401).json({ error: error.message });
    }

    res.status(200).json({
        user: data.user,
        session: data.session
    });
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

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
}

async function handleUser(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch user data from database
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        try {
            const sql = neon(databaseUrl);
            const userData = await sql`
                SELECT * FROM "User" WHERE id = ${user.id}
            `;

            if (userData.length > 0) {
                return res.status(200).json(userData[0]);
            }
        } catch (dbError) {
            console.error('[AUTH] Database error:', dbError);
            // Continue with basic user data if DB fails
        }
    }

    // Fallback to basic Supabase user data
    res.status(200).json({
        id: user.id,
        email: user.email,
        firstName: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
        lastName: user.user_metadata?.last_name || '',
        medicalRole: null,
    });
}

async function handleApplyPendingRole(req: VercelRequest, res: VercelResponse) {
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
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/auth
 * Consolidated endpoint for auth operations
 * Body: { action: 'login' | 'logout' | 'apply-pending-role', ...params }
 * GET /api/auth?action=user
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleCorsOptions(req, res)) return;

    try {
        // Get action from query (GET) or body (POST)
        const action = (req.query.action as string) || (req.body?.action as string);

        if (!action) {
            return res.status(400).json({
                error: 'Action requise',
                availableActions: ['login', 'logout', 'user', 'apply-pending-role']
            });
        }

        switch (action) {
            case 'login':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleLogin(req, res);

            case 'logout':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleLogout(req, res);

            case 'user':
                if (req.method !== 'GET' && req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleUser(req, res);

            case 'apply-pending-role':
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return await handleApplyPendingRole(req, res);

            default:
                return res.status(400).json({
                    error: `Action inconnue: ${action}`,
                    availableActions: ['login', 'logout', 'user', 'apply-pending-role']
                });
        }
    } catch (error: any) {
        console.error('[AUTH] Error:', error);
        res.status(500).json({ error: error.message });
    }
}
