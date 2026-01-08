import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Types
interface OdooParticipant {
    id: number;
    name: string;
    email: string | false;
    phone: string | false;
}

interface ParticipantMatch {
    input_name: string;
    status: 'matched' | 'unmatched' | 'ambiguous';
    partner_id: number | null;
    matched_name: string | null;
    score: number;
    candidates: Array<{ partner_id: number; name: string; score: number }>;
    needs_contact_creation: boolean;
    proposed_contact: { name: string; email: string | null; phone: string | null };
}

// ============================================================
// Utilities
// ============================================================

function normalizeForMatch(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function similarityScore(input: string, target: string): number {
    const inputNorm = normalizeForMatch(input);
    const targetNorm = normalizeForMatch(target);

    if (inputNorm === targetNorm) return 1.0;
    if (!inputNorm || !targetNorm) return 0;

    const inputTokens = new Set(inputNorm.split(' '));
    const targetTokens = new Set(targetNorm.split(' '));

    let intersection = 0;
    for (const token of inputTokens) {
        if (targetTokens.has(token)) {
            intersection++;
        } else {
            for (const tt of targetTokens) {
                if (tt.startsWith(token) || token.startsWith(tt)) {
                    intersection += 0.5;
                    break;
                }
            }
        }
    }

    const union = new Set([...inputTokens, ...targetTokens]).size;
    return union > 0 ? intersection / union : 0;
}

function matchParticipants(
    extractedNames: string[],
    odooContacts: OdooParticipant[],
    matchThreshold: number = 0.5,
    ambiguousThreshold: number = 0.1
): ParticipantMatch[] {
    return extractedNames.map((inputName) => {
        const scores = odooContacts.map((contact) => ({
            partner_id: contact.id,
            name: contact.name,
            score: similarityScore(inputName, contact.name),
        }));

        scores.sort((a, b) => b.score - a.score);

        const bestMatch = scores[0];
        const secondBest = scores[1];

        if (!bestMatch || bestMatch.score < matchThreshold) {
            return {
                input_name: inputName,
                status: 'unmatched' as const,
                partner_id: null,
                matched_name: null,
                score: bestMatch?.score || 0,
                candidates: [],
                needs_contact_creation: true,
                proposed_contact: { name: inputName, email: null, phone: null },
            };
        }

        if (
            secondBest &&
            secondBest.score > matchThreshold &&
            bestMatch.score - secondBest.score < ambiguousThreshold
        ) {
            return {
                input_name: inputName,
                status: 'ambiguous' as const,
                partner_id: null,
                matched_name: null,
                score: bestMatch.score,
                candidates: scores.filter((s) => s.score >= matchThreshold).slice(0, 3),
                needs_contact_creation: false,
                proposed_contact: { name: inputName, email: null, phone: null },
            };
        }

        return {
            input_name: inputName,
            status: 'matched' as const,
            partner_id: bestMatch.partner_id,
            matched_name: bestMatch.name,
            score: bestMatch.score,
            candidates: [],
            needs_contact_creation: false,
            proposed_contact: { name: inputName, email: null, phone: null },
        };
    });
}

function addMinutesToTime(timeStr: string, minutes: number): string {
    const [h, m, s] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m + minutes;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`;
}

function formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================
// LLM Extraction
// ============================================================

async function extractEventFromText(text: string, currentDate: Date) {
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const currentDay = dayNames[currentDate.getDay()];
    const currentDateTime = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

    const prompt = `Tu es un assistant qui extrait les informations d'un rendez-vous à partir d'une phrase dictée en français.

DATE ET HEURE ACTUELLES: ${currentDateTime}
JOUR DE LA SEMAINE: ${currentDay}

Extrais les informations suivantes au format JSON strict:
- participants: tableau de noms de personnes (ne pas inclure "je", "moi", "nous")
- start_date: la date au format "YYYY-MM-DD" (convertis les expressions relatives comme "demain", "mardi prochain" en dates réelles basées sur la date actuelle ci-dessus)
- start_time: l'heure au format "HH:MM"
- end_time: l'heure de fin si mentionnée, sinon null
- duration_minutes: la durée en minutes si mentionnée (ex: "30 minutes" → 30), sinon null
- description: une description courte du rendez-vous
- location: le lieu si mentionné, sinon chaîne vide

RÈGLES IMPORTANTES:
- Utilise la date actuelle ci-dessus pour calculer les dates relatives
- "demain" = date actuelle + 1 jour
- "mardi prochain" = prochain mardi après la date actuelle
- Si l'année n'est pas mentionnée, utilise l'année de la date actuelle
- Assure-toi que les dates sont dans le FUTUR (pas dans le passé)
- Si l'heure mentionnée est déjà passée aujourd'hui, considère que c'est pour le lendemain
- Tolère les fautes d'orthographe et les variantes de noms
- "RDV" ou "rendez-vous" signifie une réunion

Réponds UNIQUEMENT avec le JSON, sans explication.`;

    console.log('[AGENDA] Extracting event with context:', { currentDateTime, currentDay });

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: text },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';

    try {
        const parsed = JSON.parse(content);
        const participants = Array.isArray(parsed.participants) ? parsed.participants : [];

        let startDate = parsed.start_date || null;
        let startTime = parsed.start_time || null;
        let stop: string | null = null;
        const durationMinutes: number | null = parsed.duration_minutes || null;

        // Normalize time format
        if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
            startTime = startTime + ':00';
        }

        // Calculate stop time
        if (parsed.end_time) {
            let endTime = parsed.end_time;
            if (/^\d{2}:\d{2}$/.test(endTime)) {
                endTime = endTime + ':00';
            }
            if (startDate) {
                stop = `${startDate} ${endTime}`;
            }
        } else if (durationMinutes && startTime) {
            const endTime = addMinutesToTime(startTime, durationMinutes);
            if (startDate) {
                stop = `${startDate} ${endTime}`;
            }
        }

        let start: string | null = null;
        if (startDate && startTime) {
            start = `${startDate} ${startTime}`;
        }

        return {
            participants,
            start,
            stop,
            duration_minutes: durationMinutes,
            description: parsed.description || '',
            location: parsed.location || '',
        };
    } catch (e) {
        console.error('[AGENDA] Failed to parse LLM response:', content, e);
        return {
            participants: [],
            start: null,
            stop: null,
            duration_minutes: null,
            description: '',
            location: '',
        };
    }
}

/**
 * POST /api/agenda/prepare
 * Extract event data from text and match participants
 * Body: { text: string }
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
        const { text } = req.body as { text?: string };

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Le texte est requis' });
        }

        console.log('[AGENDA] Preparing event from text:', text.substring(0, 100) + '...');

        // 1. Fetch participants from n8n
        const participantsResponse = await fetch('https://treeporteur-n8n.fr/webhook/GetParticipants', {
            method: 'GET',
        });

        if (!participantsResponse.ok) {
            console.error('[AGENDA] Failed to fetch participants');
            return res.status(502).json({
                error: 'Impossible de récupérer la liste des participants',
            });
        }

        const participants: OdooParticipant[] = await participantsResponse.json();
        console.log('[AGENDA] Got', participants.length, 'participants for matching');

        // 2. Extract event with current date context
        const currentDate = new Date();
        const extracted = await extractEventFromText(text, currentDate);

        // 3. Handle missing/default values
        const warnings: string[] = [];
        let start = extracted.start;
        let stop = extracted.stop;
        const durationMinutes = extracted.duration_minutes || 60;

        if (!start) {
            const today = formatDateOnly(currentDate);
            const hours = currentDate.getHours();
            const mins = currentDate.getMinutes();
            const roundedMins = Math.ceil(mins / 15) * 15;
            const startTime = `${String(hours).padStart(2, '0')}:${String(roundedMins % 60).padStart(2, '0')}:00`;
            start = `${today} ${startTime}`;
            warnings.push('Date/heure non spécifiée => maintenant');
        }

        if (!stop && start) {
            const [datePart, timePart] = start.split(' ');
            if (timePart) {
                const endTime = addMinutesToTime(timePart, durationMinutes);
                stop = `${datePart} ${endTime}`;
                if (!extracted.duration_minutes) {
                    warnings.push('Durée non spécifiée => durée par défaut 60 min');
                }
            }
        }

        if (!extracted.location) {
            warnings.push('Lieu non spécifié');
        }

        // 4. Match participants
        const participantMatches = matchParticipants(extracted.participants, participants);

        const matchedIds = participantMatches
            .filter((p) => p.status === 'matched' && p.partner_id)
            .map((p) => p.partner_id as number);

        console.log('[AGENDA] Event prepared:', {
            participants_count: participantMatches.length,
            matched: participantMatches.filter((p) => p.status === 'matched').length,
            unmatched: participantMatches.filter((p) => p.status === 'unmatched').length,
            warnings: warnings.length,
        });

        res.json({
            to_validate: true,
            event: {
                partner_id: 3,
                participant_ids: matchedIds,
                start: start || '',
                stop: stop || '',
                description: extracted.description || 'Rendez-vous',
                location: extracted.location || '',
            },
            participants: participantMatches,
            warnings,
            raw_extraction: extracted,
        });
    } catch (error: any) {
        console.error('[AGENDA] Error preparing event:', error);
        res.status(500).json({
            error: "Erreur lors de la préparation de l'événement",
            details: error.message,
        });
    }
}
