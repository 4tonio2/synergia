import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/agenda/participants
 * Fetch all participants from Odoo via n8n GetParticipants webhook
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('[AGENDA] Fetching participants from n8n GetParticipants webhook...');

        const response = await fetch('https://treeporteur-n8n.fr/webhook/GetParticipants', {
            method: 'GET',
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('[AGENDA] GetParticipants error:', response.status, body);
            return res.status(502).json({
                error: 'Erreur lors de la récupération des participants',
            });
        }

        const participants = await response.json();
        console.log('[AGENDA] Got', Array.isArray(participants) ? participants.length : 0, 'participants');

        res.json({ participants });
    } catch (error: any) {
        console.error('[AGENDA] Error fetching participants:', error);
        res.status(500).json({
            error: 'Erreur interne lors de la récupération des participants',
            details: error.message,
        });
    }
}
