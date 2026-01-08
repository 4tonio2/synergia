import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/agenda/create-contact
 * Create a new contact via n8n CreateNewContact webhook
 * Body: { name: string, email?: string, phone?: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Le nom est requis' });
        }

        console.log('[AGENDA] Creating new contact:', { name, email, phone });

        const response = await fetch('https://treeporteur-n8n.fr/webhook/CreateNewContact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                email: email || null,
                phone: phone || null,
            }),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('[AGENDA] CreateNewContact error:', response.status, body);
            return res.status(502).json({
                error: 'Erreur lors de la création du contact',
                details: body,
            });
        }

        const createdContact = await response.json();
        console.log('[AGENDA] Contact created:', createdContact);

        res.json({
            success: true,
            contact: createdContact,
        });
    } catch (error: any) {
        console.error('[AGENDA] Error creating contact:', error);
        res.status(500).json({
            error: 'Erreur interne lors de la création du contact',
            details: error.message,
        });
    }
}
