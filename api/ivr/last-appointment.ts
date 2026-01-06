import type { VercelRequest, VercelResponse } from '@vercel/node';

// Store temporaire - doit correspondre à celui de appointment-webhook.ts
// En production, utiliser Redis ou une base de données partagée
const conversationStore = new Map<string, any>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Récupérer le dernier rendez-vous enregistré
    const lastAppointment = conversationStore.get('last-appointment');

    if (!lastAppointment || !lastAppointment.extractedData) {
      return res.status(404).json({ error: 'No appointment found' });
    }

    return res.status(200).json(lastAppointment.extractedData);
  } catch (error) {
    console.error('[Last Appointment] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
