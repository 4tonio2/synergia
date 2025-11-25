import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
      max_tokens: 200 // Limiter pour forcer la concision
    });

    const summary = completion.choices[0]?.message?.content || '';

    console.log('[GPT-4] Summary generated:', summary.substring(0, 100));

    res.status(200).json({ summary });

  } catch (error: any) {
    console.error('[GPT-4] Error generating summary:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du résumé',
      details: error.message
    });
  }
}
