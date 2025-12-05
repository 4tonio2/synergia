import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/contacts/search
 * Call unified n8n workflow to extract and search contacts, products, and appointments in Odoo.
 *
 * Expected body:
 * { text: string }
 *
 * Expected response from n8n:
 * {
 *   client_facture: { nom_complet, tel, email, reconnu, odoo_contact_id },
 *   persons: [{ nom_complet, tel, email, role_brut, is_professional, reconnu, odoo_contact_id, source, ... }],
 *   products: [{ nom_produit, quantite, prix_unitaire, description, unite }],
 *   rendez_vous: [{ date, heure, description, ... }]
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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
    const { text } = req.body as { text?: string };

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Le texte de visite est requis' });
    }

    console.log('[EXTRACT-ENTITIES] Calling unified n8n extract-entities-v4 webhook...');

    const extractResponse = await fetch(
      'https://treeporteur-n8n.fr/webhook/extract-entities-v4',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: text.trim() }),
      },
    );

    if (!extractResponse.ok) {
      const body = await extractResponse.text().catch(() => '');
      console.error('[EXTRACT-ENTITIES] Webhook error:', extractResponse.status, body);
      return res.status(502).json({
        error: 'Erreur lors de l\'extraction des entités (extract-entities-v4)',
      });
    }

    const contentType = extractResponse.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const body = await extractResponse.text().catch(() => '');
      console.error('[EXTRACT-ENTITIES] Expected JSON response but got:', contentType, body.substring(0, 200));
      return res.status(502).json({
        error: 'Le webhook n8n n\'a pas retourné une réponse JSON valide',
      });
    }

    const data: any = await extractResponse.json();

    // Structure attendue: { client_facture, persons, products, rendez_vous }
    const client_facture = data.client_facture || null;
    const persons = Array.isArray(data.persons) ? data.persons : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const rendez_vous = Array.isArray(data.rendez_vous) ? data.rendez_vous : [];

    console.log('[EXTRACT-ENTITIES] Extraction réussie:', {
      client_facture: client_facture?.nom_complet || 'N/A',
      persons_count: persons.length,
      products_count: products.length,
      rendez_vous_count: rendez_vous.length,
    });

    // Retourner la structure complète
    res.json({
      client_facture,
      persons,
      products,
      rendez_vous,
    });
  } catch (error: any) {
    console.error('[EXTRACT-ENTITIES] Unexpected error:', error);
    res.status(500).json({
      error: 'Erreur interne lors de l\'extraction des entités',
      details: error.message,
    });
  }
}
