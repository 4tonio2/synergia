import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

  } catch (error: any) {
    console.error('[GPT-4] Error generating transmission:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération de la transmission',
      details: error.message
    });
  }
}
