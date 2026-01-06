import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialiser OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Store temporaire pour les conversations (en production, utiliser Redis)
const conversationStore = new Map<string, {
  messages: Array<{ role: string; content: string }>;
  extractedData: {
    person?: string;
    date?: string;
    docteur?: string;
    phone?: string;
  };
}>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Jambonz envoie des webhooks POST avec les données de l'appel
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      call_sid,
      speech,
      from,
      to,
      call_status,
      direction
    } = req.body;

    console.log('[IVR Webhook] Received:', { call_sid, speech, call_status });

    // Initialiser ou récupérer la conversation
    if (!conversationStore.has(call_sid)) {
      conversationStore.set(call_sid, {
        messages: [],
        extractedData: {}
      });
    }

    const conversation = conversationStore.get(call_sid)!;

    // Si c'est le début de l'appel, renvoyer le message d'accueil
    if (call_status === 'ringing' || !speech) {
      return res.status(200).json([
        {
          verb: 'say',
          text: 'Bienvenue sur les services CLAUDIO. Comment puis-je vous aider ?',
          voice: 'Google.fr-FR-Standard-A'
        },
        {
          verb: 'listen',
          actionHook: `/api/ivr/appointment-webhook`,
          timeout: 10,
          finishOnKey: '#',
          transcribe: {
            language: 'fr-FR',
            transcriptionHook: `/api/ivr/appointment-webhook`
          }
        }
      ]);
    }

    // Si on a reçu de la parole, l'ajouter au contexte
    if (speech) {
      conversation.messages.push({
        role: 'user',
        content: speech
      });

      // Vérifier si l'utilisateur mentionne "rendez-vous" ou "rdv"
      const wantsAppointment = /rendez[- ]?vous|rdv|appointment|consulter|voir|docteur|médecin/i.test(speech);

      if (wantsAppointment) {
        // Utiliser GPT-4 pour extraire les informations et générer la réponse
        const systemPrompt = `Tu es CLAUDIO, un assistant téléphonique pour la prise de rendez-vous médical.
Ta mission est de collecter de manière naturelle et conversationnelle :
1. Le nom complet du patient
2. La date souhaitée du rendez-vous
3. Le docteur demandé (optionnel)

Sois chaleureux, professionnel et pose UNE question à la fois.
Si une information est déjà fournie, ne la redemande pas.
Quand tu as toutes les informations, confirme-les et remercie.

IMPORTANT : Réponds UNIQUEMENT avec ce que tu vas dire à l'utilisateur, sans instructions ni métadonnées.`;

        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...conversation.messages
        ];

        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages,
          temperature: 0.7,
          max_tokens: 150
        });

        const assistantResponse = completion.choices[0].message.content ||
          "Je n'ai pas bien compris. Pouvez-vous répéter ?";

        conversation.messages.push({
          role: 'assistant',
          content: assistantResponse
        });

        // Extraire les données structurées avec un appel séparé
        const extractionPrompt = `Analyse la conversation suivante et extrais les informations de rendez-vous au format JSON strict.

Conversation :
${conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Réponds UNIQUEMENT avec un JSON valide au format suivant (sans markdown, sans texte avant/après) :
{
  "person": "nom complet du patient ou null",
  "date": "date au format YYYY-MM-DD ou description comme '15 mars' ou null",
  "docteur": "nom du docteur ou null",
  "complete": true si toutes les infos (person et date) sont présentes, false sinon
}`;

        const extractionCompletion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: extractionPrompt }],
          temperature: 0,
          max_tokens: 200
        });

        let extractedJson: any = {};
        try {
          const jsonText = extractionCompletion.choices[0].message.content || '{}';
          // Nettoyer le markdown si présent
          const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          extractedJson = JSON.parse(cleanJson);

          // Mettre à jour les données extraites
          if (extractedJson.person) conversation.extractedData.person = extractedJson.person;
          if (extractedJson.date) conversation.extractedData.date = extractedJson.date;
          if (extractedJson.docteur) conversation.extractedData.docteur = extractedJson.docteur;
          conversation.extractedData.phone = from;

          console.log('[IVR] Extracted data:', conversation.extractedData);
        } catch (e) {
          console.error('[IVR] JSON parse error:', e);
        }

        // Si on a toutes les infos, terminer l'appel
        if (extractedJson.complete) {
          // Sauvegarder les données pour récupération
          saveAppointmentData(call_sid, conversation.extractedData);

          return res.status(200).json([
            {
              verb: 'say',
              text: assistantResponse,
              voice: 'Google.fr-FR-Standard-A'
            },
            {
              verb: 'say',
              text: 'Merci, votre rendez-vous a été enregistré. Au revoir !',
              voice: 'Google.fr-FR-Standard-A'
            },
            {
              verb: 'hangup'
            }
          ]);
        } else {
          // Continuer la conversation
          return res.status(200).json([
            {
              verb: 'say',
              text: assistantResponse,
              voice: 'Google.fr-FR-Standard-A'
            },
            {
              verb: 'listen',
              actionHook: `/api/ivr/appointment-webhook`,
              timeout: 10,
              finishOnKey: '#',
              transcribe: {
                language: 'fr-FR',
                transcriptionHook: `/api/ivr/appointment-webhook`
              }
            }
          ]);
        }
      } else {
        // L'utilisateur ne demande pas de rendez-vous
        return res.status(200).json([
          {
            verb: 'say',
            text: 'Je suis désolé, je peux uniquement vous aider à prendre un rendez-vous. Dites "rendez-vous" pour commencer.',
            voice: 'Google.fr-FR-Standard-A'
          },
          {
            verb: 'listen',
            actionHook: `/api/ivr/appointment-webhook`,
            timeout: 10,
            finishOnKey: '#',
            transcribe: {
              language: 'fr-FR',
              transcriptionHook: `/api/ivr/appointment-webhook`
            }
          }
        ]);
      }
    }

    // Fallback
    return res.status(200).json([
      {
        verb: 'say',
        text: 'Je n\'ai pas compris. Au revoir.',
        voice: 'Google.fr-FR-Standard-A'
      },
      {
        verb: 'hangup'
      }
    ]);

  } catch (error) {
    console.error('[IVR Webhook] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Fonction pour sauvegarder les données (en production, utiliser une DB)
function saveAppointmentData(callSid: string, data: any) {
  // Pour le moment, on stocke en mémoire
  // En production : Redis, PostgreSQL, etc.
  const appointmentData = {
    ...data,
    callSid,
    createdAt: new Date().toISOString()
  };

  // Stocker avec une clé "last-appointment" pour récupération facile
  conversationStore.set('last-appointment', {
    messages: [],
    extractedData: appointmentData
  });

  console.log('[IVR] Saved appointment data:', appointmentData);
}
