import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// Types Jambonz
// ============================================================

interface JambonzWebhookPayload {
    call_sid: string;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    caller_name?: string;
    call_status?: string;
    speech?: {
        alternatives: Array<{
            transcript: string;
            confidence: number;
        }>;
    };
    reason?: string;
}

interface JambonzVerb {
    verb: string;
    [key: string]: any;
}

// ============================================================
// CORS Helper
// ============================================================

function setCorsHeaders(res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
}

// ============================================================
// Action Handlers
// ============================================================

/**
 * Accueil - Premier point d'entrée de l'appel
 * Salue le client et demande s'il souhaite prendre un rendez-vous
 */
function handleWelcome(req: VercelRequest, res: VercelResponse) {
    const payload = req.body as JambonzWebhookPayload;
    console.log('[JAMBONZ] Welcome - New call:', payload.call_sid, 'from:', payload.from);

    // Construire l'URL de base pour les hooks
    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.WEBAPP_URL || 'http://localhost:5000';

    const response: JambonzVerb[] = [
        {
            verb: 'pause',
            length: 0.5
        },
        {
            verb: 'gather',
            input: ['speech'],
            actionHook: `${baseUrl}/api/jambonz?action=handle-intent`,
            timeout: 10,
            say: {
                text: 'Bienvenue chez Synergia. Souhaitez-vous prendre un rendez-vous?'
            }
        }
    ];

    console.log('[JAMBONZ] Sending welcome response with gather');
    res.status(200).json(response);
}

/**
 * Traite l'intention de l'utilisateur (oui/non pour RDV)
 */
function handleIntent(req: VercelRequest, res: VercelResponse) {
    const payload = req.body as JambonzWebhookPayload;
    console.log('[JAMBONZ] Handle intent - call_sid:', payload.call_sid, 'reason:', payload.reason);

    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.WEBAPP_URL || 'http://localhost:5000';

    // Vérifier si on a reçu une réponse vocale
    if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
        const transcript = payload.speech.alternatives[0].transcript.toLowerCase();
        console.log('[JAMBONZ] Speech detected:', transcript);

        // Détecter l'intention positive
        const positiveKeywords = ['oui', 'ouais', 'okay', 'ok', 'd\'accord', 'je veux', 'je voudrais', 'absolument', 'bien sûr', 'volontiers'];
        const isPositive = positiveKeywords.some(kw => transcript.includes(kw));

        if (isPositive) {
            console.log('[JAMBONZ] Positive intent detected - asking for booking details');

            const response: JambonzVerb[] = [
                {
                    verb: 'say',
                    text: 'Très bien! Veuillez me donner les détails de votre rendez-vous. Par exemple: avec qui, quel jour, et à quelle heure?'
                },
                {
                    verb: 'gather',
                    input: ['speech'],
                    actionHook: `${baseUrl}/api/jambonz?action=process-booking`,
                    timeout: 15,
                    say: {
                        text: 'Je vous écoute.'
                    }
                }
            ];

            return res.status(200).json(response);
        }
    }

    // Réponse négative ou timeout - proposer de l'aide ou raccrocher
    console.log('[JAMBONZ] Negative intent or timeout - ending call');

    const response: JambonzVerb[] = [
        {
            verb: 'say',
            text: 'D\'accord. Si vous avez besoin d\'aide, n\'hésitez pas à rappeler. Au revoir!'
        },
        {
            verb: 'hangup'
        }
    ];

    res.status(200).json(response);
}

/**
 * Traite la demande de rendez-vous et appelle l'API agenda
 */
async function handleProcessBooking(req: VercelRequest, res: VercelResponse) {
    const payload = req.body as JambonzWebhookPayload;
    console.log('[JAMBONZ] Process booking - call_sid:', payload.call_sid);

    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.WEBAPP_URL || 'http://localhost:5000';

    // Vérifier si on a reçu les détails du RDV
    if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
        const transcript = payload.speech.alternatives[0].transcript;
        console.log('[JAMBONZ] Booking details received:', transcript);

        // Dire à l'utilisateur de patienter
        const waitResponse: JambonzVerb[] = [
            {
                verb: 'say',
                text: 'Merci. Veuillez patienter un instant pendant que je traite votre demande.'
            },
            {
                verb: 'pause',
                length: 1
            }
        ];

        try {
            // Appeler l'API agenda pour préparer le RDV
            console.log('[JAMBONZ] Calling agenda API to prepare booking...');

            const agendaResponse = await fetch(`${baseUrl}/api/agenda`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'prepare',
                    text: transcript
                })
            });

            if (!agendaResponse.ok) {
                throw new Error(`Agenda API error: ${agendaResponse.status}`);
            }

            const agendaResult = await agendaResponse.json();
            console.log('[JAMBONZ] Agenda prepare result:', agendaResult);

            // Si le RDV est préparé, le confirmer automatiquement pour le flux vocal
            if (agendaResult.event) {
                // Confirmer le RDV
                const confirmResponse = await fetch(`${baseUrl}/api/agenda`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'confirm',
                        event: agendaResult.event,
                        participants: agendaResult.participants,
                        skipAvailabilityCheck: true
                    })
                });

                if (confirmResponse.ok) {
                    const confirmResult = await confirmResponse.json();
                    console.log('[JAMBONZ] Booking confirmed:', confirmResult);

                    const successResponse: JambonzVerb[] = [
                        ...waitResponse,
                        {
                            verb: 'say',
                            text: `Parfait! Votre rendez-vous a été créé avec succès. ${agendaResult.event.description || 'Rendez-vous'} le ${formatDateForSpeech(agendaResult.event.start)}. Merci et à bientôt!`
                        },
                        {
                            verb: 'hangup'
                        }
                    ];

                    return res.status(200).json(successResponse);
                }
            }

            // Si quelque chose n'a pas fonctionné correctement
            const partialResponse: JambonzVerb[] = [
                ...waitResponse,
                {
                    verb: 'say',
                    text: 'J\'ai noté votre demande, mais je n\'ai pas pu confirmer tous les détails. Un conseiller vous recontactera. Merci et au revoir!'
                },
                {
                    verb: 'hangup'
                }
            ];

            return res.status(200).json(partialResponse);

        } catch (error: any) {
            console.error('[JAMBONZ] Error processing booking:', error);

            const errorResponse: JambonzVerb[] = [
                {
                    verb: 'say',
                    text: 'Désolé, une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard. Au revoir!'
                },
                {
                    verb: 'hangup'
                }
            ];

            return res.status(200).json(errorResponse);
        }
    }

    // Timeout ou pas de réponse
    console.log('[JAMBONZ] No booking details received - ending call');

    const response: JambonzVerb[] = [
        {
            verb: 'say',
            text: 'Je n\'ai pas pu comprendre votre demande. Veuillez rappeler pour réessayer. Au revoir!'
        },
        {
            verb: 'hangup'
        }
    ];

    res.status(200).json(response);
}

/**
 * Handler pour les notifications de statut d'appel
 */
function handleCallStatus(req: VercelRequest, res: VercelResponse) {
    const payload = req.body;
    console.log('[JAMBONZ] Call status update:', payload.call_sid, payload.call_status);

    // Juste accuser réception
    res.status(200).json({ received: true });
}

// ============================================================
// Helpers
// ============================================================

function formatDateForSpeech(dateStr: string): string {
    if (!dateStr) return '';

    try {
        // Format: "2026-01-15 14:30:00"
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart?.split(':') || ['', ''];

        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        const monthName = months[parseInt(month) - 1] || month;

        return `${parseInt(day)} ${monthName} à ${parseInt(hour)} heures ${parseInt(minute) > 0 ? parseInt(minute) : ''}`.trim();
    } catch {
        return dateStr;
    }
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/jambonz?action=welcome|handle-intent|process-booking|call-status
 * Endpoint consolidé pour les webhooks Jambonz
 * Note: Jambonz attend TOUJOURS un tableau de verbes en réponse
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        // Jambonz attend toujours un tableau
        const errorResponse: JambonzVerb[] = [
            { verb: 'say', text: 'Méthode non autorisée.' },
            { verb: 'hangup' }
        ];
        return res.status(200).json(errorResponse);
    }

    try {
        // Default to 'welcome' if no action is specified (initial call from Jambonz)
        const action = (req.query.action as string) || 'welcome';

        console.log('[JAMBONZ] Handling action:', action, 'body:', JSON.stringify(req.body).substring(0, 200));

        switch (action) {
            case 'welcome':
                return handleWelcome(req, res);

            case 'handle-intent':
                return handleIntent(req, res);

            case 'process-booking':
                return await handleProcessBooking(req, res);

            case 'call-status':
                return handleCallStatus(req, res);

            default:
                // Action inconnue - retourner un tableau valide
                console.log('[JAMBONZ] Unknown action:', action);
                const unknownResponse: JambonzVerb[] = [
                    { verb: 'say', text: 'Bienvenue chez Synergia.' },
                    { verb: 'hangup' }
                ];
                return res.status(200).json(unknownResponse);
        }
    } catch (error: any) {
        console.error('[JAMBONZ] Error:', error);

        // En cas d'erreur, toujours retourner un JSON valide pour Jambonz
        const errorResponse: JambonzVerb[] = [
            {
                verb: 'say',
                text: 'Une erreur technique est survenue. Veuillez réessayer plus tard.'
            },
            {
                verb: 'hangup'
            }
        ];

        res.status(200).json(errorResponse);
    }
}
