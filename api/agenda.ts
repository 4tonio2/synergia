import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
// Using RAG environment variables as in jambonz.ts, defaulting to standard if not present
const supabase = createClient(
	process.env.SUPABASE_URL_RAG || '',
	process.env.SUPABASE_ANON_KEY_RAG || ''
);

// ============================================================
// Types
// ============================================================

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

interface AvailabilityCheckResult {
	success: boolean;
	attempts: number;
	start?: string;
	stop?: string;
	message?: string;
}

interface ContactMatch {
	id: number;
	contact_id: number;
	name: string;
	content: string;
	metadata: any;
	similarity: number;
}

// ============================================================
// Utilities
// ============================================================

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
// Vector Search Utilities
// ============================================================

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
	});
	return response.data[0].embedding;
}

/**
 * Match a single name against contacts using vector search
 * Returns top matches sorted by similarity
 */
async function matchContactByVector(name: string, matchCount: number = 5): Promise<ContactMatch[]> {
	console.log('[AGENDA] Vector search for:', name);

	try {
		const embedding = await generateEmbedding(name);

		const { data, error } = await supabase.rpc('match_contact_name_embeddings', {
			filter: {},
			match_count: matchCount,
			query_embedding: embedding,
		});

		if (error) {
			console.error('[AGENDA] Vector search error:', error);
			return [];
		}

		console.log('[AGENDA] Vector search results:', data?.length || 0, 'matches');
		return (data as ContactMatch[]) || [];
	} catch (error) {
		console.error('[AGENDA] Error in vector search:', error);
		return [];
	}
}

/**
 * Match participants using vector search
 * This replaces the old fuzzy matching against all contacts
 */
async function matchParticipantsWithVector(
	extractedNames: string[],
	matchThreshold: number = 0.85, // Higher threshold for vector search confidence
	ambiguousThreshold: number = 0.1
): Promise<ParticipantMatch[]> {
	if (!extractedNames || extractedNames.length === 0) return [];

	console.log('[AGENDA] Matching participants via vector search:', extractedNames);

	const results = await Promise.all(
		extractedNames.map(async (inputName) => {
			const matches = await matchContactByVector(inputName);

			if (matches.length === 0) {
				return {
					input_name: inputName,
					status: 'unmatched' as const,
					partner_id: null,
					matched_name: null,
					score: 0,
					candidates: [],
					needs_contact_creation: true,
					proposed_contact: { name: inputName, email: null, phone: null },
				};
			}

			const bestMatch = matches[0];
			const secondBest = matches[1];

			// Check for high confidence match
			if (bestMatch.similarity >= matchThreshold) {
				// Check for ambiguity (two very similar scores)
				if (secondBest && (bestMatch.similarity - secondBest.similarity < ambiguousThreshold)) {
					return {
						input_name: inputName,
						status: 'ambiguous' as const,
						partner_id: null,
						matched_name: null,
						score: bestMatch.similarity,
						candidates: matches.slice(0, 3).map(m => ({
							partner_id: m.contact_id,
							name: m.name,
							score: m.similarity
						})),
						needs_contact_creation: false,
						proposed_contact: { name: inputName, email: null, phone: null },
					};
				}

				return {
					input_name: inputName,
					status: 'matched' as const,
					partner_id: bestMatch.contact_id,
					matched_name: bestMatch.name,
					score: bestMatch.similarity,
					candidates: [],
					needs_contact_creation: false,
					proposed_contact: { name: inputName, email: null, phone: null },
				};
			}

			// Low confidence matches -> Ambiguous or Unmatched
			if (bestMatch.similarity > 0.6) { // Soft threshold for suggesting candidates
				return {
					input_name: inputName,
					status: 'ambiguous' as const,
					partner_id: null,
					matched_name: null,
					score: bestMatch.similarity,
					candidates: matches.slice(0, 3).map(m => ({
						partner_id: m.contact_id,
						name: m.name,
						score: m.similarity
					})),
					needs_contact_creation: false,
					proposed_contact: { name: inputName, email: null, phone: null },
				};
			}

			// No good match
			return {
				input_name: inputName,
				status: 'unmatched' as const,
				partner_id: null,
				matched_name: null,
				score: bestMatch.similarity,
				candidates: [],
				needs_contact_creation: true,
				proposed_contact: { name: inputName, email: null, phone: null },
			};
		})
	);

	return results;
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
- Ignore les titres comme "Docteur", "Monsieur", "Madame" dans les noms de participants si possible

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

// ============================================================
// Action Handlers
// ============================================================

async function handlePrepare(req: VercelRequest, res: VercelResponse) {
	const { text } = req.body as { text?: string };

	if (!text || !text.trim()) {
		return res.status(400).json({ error: 'Le texte est requis' });
	}

	console.log('[AGENDA] Preparing event from text:', text.substring(0, 100) + '...');

	// 1. Extract event with current date context (Using LLM)
	const currentDate = new Date();
	const extracted = await extractEventFromText(text, currentDate);

	console.log('[AGENDA] Extracted data:', extracted);

	// 2. Handle missing/default values
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

	// 3. Match participants using Vector Search
	// No longer running fuzzy match against all contacts
	const participantMatches = await matchParticipantsWithVector(extracted.participants);

	const matchedIds = participantMatches
		.filter((p) => p.status === 'matched' && p.partner_id)
		.map((p) => p.partner_id as number);

	console.log('[AGENDA] Event prepared matches:', {
		participants_count: participantMatches.length,
		matched: participantMatches.filter((p) => p.status === 'matched').length,
		ambiguous: participantMatches.filter((p) => p.status === 'ambiguous').length,
		unmatched: participantMatches.filter((p) => p.status === 'unmatched').length,
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
}

async function handleCheckAvailability(req: VercelRequest, res: VercelResponse) {
	const { contact_ids, start, stop } = req.body as { contact_ids?: number[]; start?: string; stop?: string };

	if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
		return res.status(400).json({ error: 'contact_ids est requis (tableau de IDs)' });
	}

	if (!start || !stop) {
		return res.status(400).json({ error: 'start et stop sont requis' });
	}

	console.log('[AGENDA] Checking availability for:', { contact_ids, start, stop });

	try {
		const response = await fetch('https://treeporteur-n8n.fr/webhook/check-availability', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contact_ids, start, stop }),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => '');
			console.error('[AGENDA] check-availability webhook error:', response.status, errorBody);
			return res.status(502).json({
				error: 'Erreur lors de la vérification de disponibilité',
				details: errorBody,
			});
		}

		const result = await response.json() as AvailabilityCheckResult;
		console.log('[AGENDA] Availability check result:', result);

		// Ensure we pass back the start/stop from the webhook if available, otherwise use input
		const confirmedStart = result.start || start;
		const confirmedStop = result.stop || stop;

		res.json({
			success: true,
			attempts: result.attempts || 0,
			start: confirmedStart,
			stop: confirmedStop,
			message: result.attempts > 0
				? `${result.attempts} conflit(s) détecté(s).`
				: 'Aucun conflit détecté, le créneau est disponible.',
		});
	} catch (error: any) {
		console.error('[AGENDA] check-availability error:', error);
		res.status(500).json({
			error: 'Erreur lors de la vérification de disponibilité',
			details: error.message,
		});
	}
}

async function handleConfirm(req: VercelRequest, res: VercelResponse) {
	const { event, participants, skipAvailabilityCheck } = req.body as { event?: any; participants?: any[]; skipAvailabilityCheck?: boolean };

	if (!event) {
		return res.status(400).json({ error: "Les données de l'événement sont requises" });
	}

	console.log('[AGENDA] Confirming event:', {
		start: event.start,
		stop: event.stop,
		participant_ids: event.participant_ids,
		description: event.description,
		skipAvailabilityCheck,
	});

	// Prepare payload for n8n webhook
	const webhookPayload = {
		name: event.description || 'Rendez-vous',
		start: event.start,
		stop: event.stop,
		partner_id: 3,
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
}

async function handleParticipants(req: VercelRequest, res: VercelResponse) {
	console.log('[AGENDA] Fetching participants from n8n GetParticipants webhook...');

	const response = await fetch('https://treeporteur-n8n.fr/webhook/GetParticipants', {
		method: 'GET',
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('[AGENDA] GetParticipants error:', response.status, body);
		return res.status(502).json({
			error: 'Erreur lors de la récupération des participants',
		});
	}

	const participants = await response.json();
	console.log('[AGENDA] Got', Array.isArray(participants) ? participants.length : 0, 'participants');

	res.json({ participants });
}

async function handleCreateContact(req: VercelRequest, res: VercelResponse) {
	const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };

	if (!name || !name.trim()) {
		return res.status(400).json({ error: 'Le nom est requis' });
	}

	console.log('[AGENDA] Creating new contact:', { name, email, phone });

	const response = await fetch('https://treeporteur-n8n.fr/webhook/CreateNewContact', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: name.trim(),
			email: email || null,
			phone: phone || null,
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('[AGENDA] CreateNewContact error:', response.status, body);
		return res.status(502).json({
			error: 'Erreur lors de la création du contact',
			details: body,
		});
	}

	const createdContact = await response.json();
	console.log('[AGENDA] Contact created:', createdContact);

	res.json({
		success: true,
		contact: createdContact,
	});
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/agenda
 * Consolidated endpoint for agenda operations
 * Body: { action: 'prepare' | 'confirm' | 'participants' | 'create-contact', ...params }
 * GET /api/agenda?action=participants
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	// CORS headers
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
	);

	if (req.method === 'OPTIONS') {
		res.status(200).end();
		return;
	}

	try {
		// Get action from query (GET) or body (POST)
		const action = (req.query.action as string) || (req.body?.action as string);

		if (!action) {
			return res.status(400).json({
				error: 'Action requise',
				availableActions: ['prepare', 'confirm', 'check-availability', 'participants', 'create-contact']
			});
		}

		switch (action) {
			case 'prepare':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for prepare' });
				}
				return await handlePrepare(req, res);

			case 'confirm':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for confirm' });
				}
				return await handleConfirm(req, res);

			case 'check-availability':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for check-availability' });
				}
				return await handleCheckAvailability(req, res);

			case 'participants':
				if (req.method !== 'GET' && req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for participants' });
				}
				return await handleParticipants(req, res);

			case 'create-contact':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for create-contact' });
				}
				return await handleCreateContact(req, res);

			default:
				return res.status(400).json({
					error: `Action inconnue: ${action}`,
					availableActions: ['prepare', 'confirm', 'check-availability', 'participants', 'create-contact']
				});
		}
	} catch (error: any) {
		console.error('[AGENDA] Error:', error);
		res.status(500).json({
			error: 'Erreur interne',
			details: error.message,
		});
	}
}
