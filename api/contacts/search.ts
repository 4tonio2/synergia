import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/contacts/search
 * Orchestrate n8n workflows to search contacts in Odoo based on visit notes.
 *
 * Expected body:
 * { text: string }
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

    console.log('[CONTACTS] Calling n8n extract-contacts webhook...');

    const extractResponse = await fetch(
      'https://treeporteur-n8n.fr/webhook/extract-contacts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: text.trim() }),
      },
    );

    if (!extractResponse.ok) {
      const body = await extractResponse.text().catch(() => '');
      console.error('[CONTACTS] extract-contacts error:', extractResponse.status, body);
      return res.status(502).json({
        error: 'Erreur lors de la détection des personnes (extract-contacts)',
      });
    }

    const contentType = extractResponse.headers.get('content-type') || '';

    let persons: any[] = [];

    if (contentType.includes('application/json')) {
      // Cas où le workflow renvoie déjà du JSON structuré
      const extractData: any = await extractResponse.json();
      persons =
        extractData.persons ||
        extractData.Personnes ||
        extractData.contacts ||
        [];
    } else {
      // Cas actuel : réponse texte au format:
      // Personne 1:
      // - nom_complet: ...
      // - tel: ...
      // ...
      const raw = await extractResponse.text();
      console.log(
        '[CONTACTS] Text response from extract-contacts, attempting to parse:',
      );
      console.log(raw);

      const blocks = raw
        .split(/Personne\s+\d+\s*:/i)
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      persons = blocks.map((block) => {
        const person: any = {};
        const lines = block.split('\n');

        for (const line of lines) {
          const match = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
          if (!match) continue;

          const rawKey = match[1].trim();
          const value = match[2].trim();

          // Normaliser les clés vers le format attendu
          const key = rawKey
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w_]/g, '');

          switch (key) {
            case 'nom_complet':
            case 'tel':
            case 'email':
            case 'profession_code':
            case 'type_acteur':
            case 'grande_categorie_acteur':
            case 'sous_categorie_acteur':
              person[key] = value;
              break;
            default:
              // On garde quand même au cas où
              person[key] = value;
          }
        }

        return person;
      });
    }

    if (!Array.isArray(persons) || persons.length === 0) {
      console.log('[CONTACTS] No persons detected by extract-contacts');
      return res.json({ persons: [] });
    }

    const fields = [
      'nom_complet',
      'tel',
      'email',
      'profession_code',
      'type_acteur',
      'grande_categorie_acteur',
      'sous_categorie_acteur',
    ];

    const results: Array<{
      input: any;
      match: any | null;
      requiresConsent?: boolean;
      consentAction?: string;
    }> = [];

    for (const person of persons) {
      const hasAnyField = fields.some((key) => {
        const value = person?.[key];
        return typeof value === 'string' ? value.trim().length > 0 : !!value;
      });

      if (!hasAnyField) {
        results.push({
          input: person,
          match: null,
        });
        continue;
      }

      console.log(
        '[CONTACTS] Calling n8n Agent-contacts for person:',
        person?.nom_complet || '(sans nom)',
      );

      // Construire une userQuery textuelle à partir des champs de la personne
      const personLines: string[] = [];
      if (person.nom_complet) personLines.push(`nom_complet: ${person.nom_complet}`);
      if (person.tel) personLines.push(`tel: ${person.tel}`);
      if (person.email) personLines.push(`email: ${person.email}`);
      if (person.profession_code) personLines.push(`profession_code: ${person.profession_code}`);
      if (person.type_acteur) personLines.push(`type_acteur: ${person.type_acteur}`);
      if (person.grande_categorie_acteur) {
        personLines.push(
          `grande_categorie_acteur: ${person.grande_categorie_acteur}`,
        );
      }
      if (person.sous_categorie_acteur) {
        personLines.push(`sous_categorie_acteur: ${person.sous_categorie_acteur}`);
      }

      const agentPayload = {
        userQuery:
          personLines.length > 0
            ? personLines.join('\n')
            : JSON.stringify(person),
      };

      const agentResponse = await fetch(
        'https://treeporteur-n8n.fr/webhook/Agent-contacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentPayload),
        },
      );

      if (!agentResponse.ok) {
        const body = await agentResponse.text().catch(() => '');
        console.error('[CONTACTS] Agent-contacts error:', agentResponse.status, body);
        results.push({
          input: person,
          match: null,
        });
        continue;
      }

      const agentText = await agentResponse.text();

      if (agentText.includes('[NONE]')) {
        // Match is null - require user consent before upserting
        console.log('[CONTACTS] No match found for person:', person?.nom_complet);
        results.push({
          input: person,
          match: null,
          requiresConsent: true,
          consentAction: 'pending', // pending | approved | rejected
        });
        continue;
      }

      let parsedMatch: any = null;
      try {
        parsedMatch = JSON.parse(agentText);
      } catch {
        // Le webhook retourne du texte formaté, pas du JSON
        // Format: "Information 1:\n - nom_complet: ...\n - tel: ...\n\nInformation 2:\n..."
        console.log('[CONTACTS] Parsing text response:', agentText.substring(0, 200));
        
        // Parser le texte formaté
        const parsedPersons: any[] = [];
        
        // Séparer par "Information X:" en utilisant une regex
        const infoBlocks = agentText.split(/Information\s+\d+\s*:/i).filter((b: string) => b.trim());
        
        for (const block of infoBlocks) {
          const personData: any = {};
          // Séparer par les vrais retours à la ligne (pas les \n littéraux)
          // Le texte peut contenir soit de vrais \n soit le texte littéral "\n"
          const lines = block
            .replace(/\\n/g, '\n')  // Convertir les \n littéraux en vrais retours à la ligne
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 0);
          
          for (const line of lines) {
            // Format: "- clé: valeur" ou "clé: valeur"
            const match = line.match(/^\s*-?\s*([^:]+):\s*(.*)$/);
            if (match) {
              const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
              const value = match[2].trim();
              if (value) {
                personData[key] = value;
              }
            }
          }
          
          if (Object.keys(personData).length > 0) {
            parsedPersons.push(personData);
          }
        }
        
        if (parsedPersons.length > 0) {
          // Si on a parsé plusieurs personnes, on les retourne toutes
          parsedMatch = parsedPersons.length === 1 ? parsedPersons[0] : { persons: parsedPersons, raw: agentText };
        } else {
          // Si le parsing a échoué, garder le texte brut
          parsedMatch = { raw: agentText };
        }
      }

      results.push({
        input: person,
        match: parsedMatch,
      });
    }

    res.json({ persons: results });
  } catch (error: any) {
    console.error('[CONTACTS] Unexpected error:', error);
    res.status(500).json({
      error: 'Erreur interne lors de la recherche de contacts',
      details: error.message,
    });
  }
}
