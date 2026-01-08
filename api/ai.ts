import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from './_helpers';

// ============================================================
// Action Handlers
// ============================================================

async function handleSummary(req: VercelRequest, res: VercelResponse) {
    const { patientName, patientAge, visitType, painLevel, notesRaw } = req.body;

    if (!notesRaw || typeof notesRaw !== 'string') {
        return res.status(400).json({ error: 'notesRaw is required' });
    }

    const openai = getOpenAIClient();

    console.log('[GPT-4] Generating summary for:', { patientName, visitType });

    const prompt = `Tu es un assistant médical. Rédige un résumé TRÈS COURT et CONCIS de cette visite médicale à domicile.

**IMPORTANT** : Le résumé doit être **MAXIMUM 4-5 lignes**, style **télégraphique**.

**Format attendu (exemple)** :
**Soins de pansement** - Patient de 78 ans / Observations: Plaie jambe droite en amélioration, bords moins rouges, pas d'écoulement, douleur modérée (3/10) / Actions: Nettoyage, désinfection, nouveau pansement / Suivi: Surveillance évolution, contrôle dans 48h

Informations de la visite :
- Patient : ${patientName || 'Non spécifié'} (${patientAge || 'N/A'} ans)
- Type de visite : ${visitType || 'Non spécifié'}
- Niveau de douleur : ${painLevel !== undefined ? `${painLevel}/10` : 'Non évalué'}

Notes de l'infirmier(ère) :
${notesRaw}

Rédige un résumé structuré TRÈS COURT (4-5 lignes maximum) au format indiqué ci-dessus.`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: 'Tu es un assistant médical spécialisé dans la rédaction de résumés de visites à domicile. Tes résumés sont TRÈS COURTS et CONCIS, style télégraphique, maximum 4-5 lignes.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.3,
        max_tokens: 200
    });

    const summary = completion.choices[0]?.message?.content || '';

    console.log('[GPT-4] Summary generated:', summary.substring(0, 100));

    res.status(200).json({ summary });
}

async function handleTransmission(req: VercelRequest, res: VercelResponse) {
    const { patientName, patientAge, visitType, painLevel, notesRaw, notesSummary } = req.body;

    if (!notesRaw || typeof notesRaw !== 'string') {
        return res.status(400).json({ error: 'notesRaw is required' });
    }

    const openai = getOpenAIClient();

    console.log('[GPT-4] Generating transmission for:', { patientName, visitType });

    const prompt = `Tu es un(e) infirmier(ère) qui doit rédiger une transmission pour le médecin traitant.

Informations de la visite :
- Patient : ${patientName || 'Non spécifié'} (${patientAge || 'N/A'} ans)
- Type de visite : ${visitType || 'Non spécifié'}
- Niveau de douleur : ${painLevel !== undefined ? `${painLevel}/10` : 'Non évalué'}

${notesSummary ? `Résumé : ${notesSummary}\n\n` : ''}Notes complètes :
${notesRaw}

Rédige une transmission professionnelle pour le médecin (format SOAP ou narratif médical). 
Sois concis mais précis. Mentionne les éléments clés qui nécessitent l'attention du médecin.`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: 'Tu es un(e) infirmier(ère) expérimenté(e) qui rédige des transmissions médicales claires et professionnelles pour les médecins.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.3,
        max_tokens: 400
    });

    const transmission = completion.choices[0]?.message?.content || '';

    console.log('[GPT-4] Transmission generated:', transmission.substring(0, 100));

    res.status(200).json({ transmission });
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/ai
 * Consolidated endpoint for AI operations
 * Body: { action: 'summary' | 'transmission', ...params }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleCorsOptions(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const action = req.body?.action as string;

        if (!action) {
            return res.status(400).json({
                error: 'Action requise',
                availableActions: ['summary', 'transmission']
            });
        }

        switch (action) {
            case 'summary':
                return await handleSummary(req, res);

            case 'transmission':
                return await handleTransmission(req, res);

            default:
                return res.status(400).json({
                    error: `Action inconnue: ${action}`,
                    availableActions: ['summary', 'transmission']
                });
        }
    } catch (error: any) {
        console.error('[AI] Error:', error);
        res.status(500).json({
            error: 'Erreur lors du traitement AI',
            details: error.message
        });
    }
}
