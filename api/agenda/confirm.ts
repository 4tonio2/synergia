import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/agenda/confirm
 * Confirm event creation - calls n8n CreateCalendarEvent webhook
 * Body: { event: {...}, participants: [...] }
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
        const { event, participants } = req.body as { event?: any; participants?: any[] };

        if (!event) {
            return res.status(400).json({ error: "Les données de l'événement sont requises" });
        }

        console.log('[AGENDA] Confirming event:', {
            start: event.start,
            stop: event.stop,
            participant_ids: event.participant_ids,
            description: event.description,
        });

        // Prepare payload for n8n webhook
        const webhookPayload = {
            name: event.description || 'Rendez-vous',
            start: event.start,
            stop: event.stop,
            partner_id: 3, // Always 3 as per requirements
            partner_ids: event.participant_ids || [],
        };

        console.log('[AGENDA] Calling CreateCalendarEvent webhook with:', webhookPayload);

        // Call n8n webhook to create calendar event
        const webhookResponse = await fetch('https://treeporteur-n8n.fr/webhook/CreateCalendarEvent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });

        if (!webhookResponse.ok) {
            const errorBody = await webhookResponse.text().catch(() => '');
            console.error('[AGENDA] CreateCalendarEvent webhook error:', webhookResponse.status, errorBody);
            return res.status(502).json({
                error: "Erreur lors de la création de l'événement dans Odoo",
                details: errorBody,
            });
        }

        const webhookResult = await webhookResponse.json().catch(() => ({}));
        console.log('[AGENDA] Calendar event created:', webhookResult);

        // Build participant names for summary
        const participantNames =
            participants
                ?.filter((p: any) => p.status === 'matched' || p.partner_id)
                .map((p: any) => p.matched_name || p.input_name)
                .join(', ') || 'Aucun participant';

        res.json({
            success: true,
            message: 'Événement créé avec succès dans Odoo Agenda',
            odoo_response: webhookResult,
            summary: {
                title: event.description || 'Rendez-vous',
                start: event.start,
                stop: event.stop,
                location: event.location || 'Non spécifié',
                participants: participantNames,
                participant_ids: event.participant_ids || [],
            },
        });
    } catch (error: any) {
        console.error('[AGENDA] Error confirming event:', error);
        res.status(500).json({
            error: "Erreur lors de la confirmation de l'événement",
            details: error.message,
        });
    }
}
