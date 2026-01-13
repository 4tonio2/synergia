/**
 * Jambonz IVR Service for local Express server
 * Synchronized with api/jambonz.ts - New workflow with create/cancel menu
 */

import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================
// Clients
// ============================================================

const supabase = createClient(
	process.env.SUPABASE_URL_RAG || '',
	process.env.SUPABASE_ANON_KEY_RAG || ''
);

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================
// Types
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
	digits?: string;
	reason?: string;
}

interface JambonzVerb {
	verb: string;
	[key: string]: any;
}

interface CallerInfo {
	id: number;
	name: string;
	email: string | null;
	phone: string | null;
	mobile: string | boolean;
}

interface CalendarEvent {
	id: number;
	name: string;
	start: string;
	stop: string;
	allday: boolean;
	location: string | false;
	description: string | false;
	partner_ids: number[];
}

interface ParticipantMatch {
	input_name: string;
	status: 'matched' | 'unmatched' | 'ambiguous';
	partner_id: number | null;
	matched_name: string | null;
	score: number;
	candidates: Array<{ partner_id: number; name: string; score: number; email?: string; phone?: string }>;
}

interface ContactEmbeddingMatch {
	id: number;
	contact_id: number;
	name: string;
	content: string;
	metadata: any;
	similarity: number;
}

interface ExtractedEventInfo {
	names: string[];
	location: string | null;
	reason: string | null;
	start: string | null;
	stop: string | null;
}

interface AvailabilityCheckResult {
	success: boolean;
	attempts: number;
	start?: string;
	stop?: string;
	message?: string;
}

// ============================================================
// Helpers
// ============================================================

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return 'Bonjour';
	if (hour < 18) return 'Bon après-midi';
	return 'Bonsoir';
}

function getBaseUrl(): string {
	return process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: process.env.WEBAPP_URL || 'http://localhost:5000';
}

function getCurrentDateStr(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatDateForSpeech(dateStr: string): string {
	if (!dateStr) return '';
	try {
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

/**
 * Normalize phone number format: convert 00XXX to +XXX
 * Jambonz sends phone numbers with 00 prefix instead of +
 */
function normalizePhoneNumber(phone: string): string {
	if (phone.startsWith('00')) {
		return '+' + phone.slice(2);
	}
	return phone;
}

// ============================================================
// API Calls
// ============================================================

async function identifyCallerByPhone(phone: string): Promise<CallerInfo | null> {
	const normalizedPhone = normalizePhoneNumber(phone);
	console.log('[JAMBONZ] Identifying caller by phone:', phone, '-> normalized:', normalizedPhone);
	try {
		const response = await fetch('https://treeporteur-n8n.fr/webhook/AuthContact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier: normalizedPhone }),
		});

		if (!response.ok) {
			console.error('[JAMBONZ] AuthContact webhook error:', response.status);
			return null;
		}

		const data = await response.json() as CallerInfo;
		console.log('[JAMBONZ] Caller identified:', data.name, 'id:', data.id);
		return data;
	} catch (error) {
		console.error('[JAMBONZ] Error identifying caller:', error);
		return null;
	}
}

async function fetchCallerEvents(partnerId: number): Promise<CalendarEvent[]> {
	console.log('[JAMBONZ] Fetching calendar events for partner:', partnerId);
	try {
		const response = await fetch('https://treeporteur-n8n.fr/webhook-test/GetUserCalendarEvents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ partner_id: partnerId }),
		});

		if (!response.ok) {
			console.error('[JAMBONZ] GetUserCalendarEvents error:', response.status);
			return [];
		}

		const events = await response.json() as CalendarEvent[];
		console.log('[JAMBONZ] Got', events.length, 'calendar events');
		return events;
	} catch (error) {
		console.error('[JAMBONZ] Error fetching calendar events:', error);
		return [];
	}
}

async function generateEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
	});
	return response.data[0].embedding;
}

async function matchContactByEmbedding(name: string, matchCount: number = 7): Promise<ContactEmbeddingMatch[]> {
	console.log('[JAMBONZ] Vector search for:', name);
	try {
		const embedding = await generateEmbedding(name);
		const { data, error } = await supabase.rpc('match_contact_name_embeddings', {
			filter: {},
			match_count: matchCount,
			query_embedding: embedding,
		});

		if (error) {
			console.error('[JAMBONZ] Vector search error:', error);
			return [];
		}

		console.log('[JAMBONZ] Vector search results:', data?.length || 0, 'matches');
		return (data as ContactEmbeddingMatch[]) || [];
	} catch (error) {
		console.error('[JAMBONZ] Error in vector search:', error);
		return [];
	}
}

async function matchMultipleContactsParallel(names: string[]): Promise<Map<string, ContactEmbeddingMatch[]>> {
	console.log('[JAMBONZ] Parallel search for', names.length, 'names:', names);
	const results = new Map<string, ContactEmbeddingMatch[]>();

	const searches = await Promise.all(
		names.map(async (name) => ({
			name,
			matches: await matchContactByEmbedding(name),
		}))
	);

	for (const { name, matches } of searches) {
		results.set(name, matches);
	}

	return results;
}

async function extractEventInfoFromTranscript(transcript: string): Promise<ExtractedEventInfo> {
	const currentDate = getCurrentDateStr();
	console.log('[JAMBONZ] Extracting event info from transcript. Current date:', currentDate);

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `Tu es un assistant qui extrait les informations d'un rendez-vous depuis une phrase vocale.
La date actuelle est: ${currentDate} (année 2026).
Retourne un JSON avec les champs suivants:
- names: tableau des noms de personnes mentionnées (prénom et/ou nom)
- location: lieu du rendez-vous (null si non mentionné)
- reason: raison ou titre du rendez-vous (null si non mentionné)
- start: date et heure de début au format "AAAA-MM-DD HH:MM" (null si non mentionné)
- stop: date et heure de fin au format "AAAA-MM-DD HH:MM" (null si non mentionné, sinon +1h par défaut)

Règles importantes:
- Si "demain" est mentionné, calcule la date du lendemain
- Si "lundi", "mardi", etc. est mentionné, calcule la prochaine occurrence
- Ne réserve JAMAIS dans le passé (avant ${currentDate})
- Si seule l'heure de début est mentionnée, calcule stop = start + 1 heure

Exemples:
- "rendez-vous avec Marc demain à 14h" → {"names": ["Marc"], "location": null, "reason": null, "start": "2026-01-12 14:00", "stop": "2026-01-12 15:00"}
- "voir Jean au bureau lundi 10h pour une visite" → {"names": ["Jean"], "location": "bureau", "reason": "visite", "start": "2026-01-13 10:00", "stop": "2026-01-13 11:00"}`
				},
				{
					role: 'user',
					content: transcript
				}
			],
			temperature: 0,
			max_tokens: 500,
			response_format: { type: 'json_object' }
		});

		const content = response.choices[0]?.message?.content || '{}';
		console.log('[JAMBONZ] GPT extracted event info:', content);

		const parsed = JSON.parse(content);
		return {
			names: parsed.names || [],
			location: parsed.location || null,
			reason: parsed.reason || null,
			start: parsed.start || null,
			stop: parsed.stop || null,
		};
	} catch (error) {
		console.error('[JAMBONZ] Error extracting event info:', error);
		return { names: [], location: null, reason: null, start: null, stop: null };
	}
}

// ============================================================
// Handlers
// ============================================================

async function handleWelcome(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Welcome - New call:', payload.call_sid, 'from:', payload.from);

	const baseUrl = getBaseUrl();
	const caller = await identifyCallerByPhone(payload.from);
	const greeting = getGreeting();

	let events: CalendarEvent[] = [];
	if (caller?.id) {
		events = await fetchCallerEvents(caller.id);
	}

	const callerIdParam = caller?.id ? `&caller_id=${caller.id}&caller_name=${encodeURIComponent(caller.name)}` : '';
	const eventsParam = events.length > 0 ? `&events=${encodeURIComponent(JSON.stringify(events))}` : '';

	let welcomeText: string;
	if (caller?.name) {
		welcomeText = `${greeting} ${caller.name}! C'est un plaisir de vous entendre. Comment puis-je vous aider aujourd'hui? Tapez 1 pour prendre un nouveau rendez-vous, ou tapez 2 pour annuler un rendez-vous existant.`;
	} else {
		welcomeText = `${greeting}! Bienvenue chez Synergia. Comment puis-je vous aider? Tapez 1 pour prendre un rendez-vous, ou tapez 2 pour annuler un rendez-vous.`;
	}

	const response: JambonzVerb[] = [
		{ verb: 'pause', length: 0.5 },
		{
			verb: 'gather',
			input: ['digits'],
			numDigits: 1,
			actionHook: `${baseUrl}/api/jambonz?action=main-menu${callerIdParam}${eventsParam}`,
			timeout: 10,
			say: { text: welcomeText }
		}
	];

	console.log('[JAMBONZ] Sending welcome response, caller:', caller?.name || 'unknown', 'events:', events.length);
	res.status(200).json(response);
}

function handleMainMenu(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const baseUrl = getBaseUrl();
	const callerId = req.query.caller_id as string || '';
	const callerName = req.query.caller_name as string || '';
	const eventsParam = req.query.events as string || '[]';
	const callerParams = callerId ? `&caller_id=${callerId}&caller_name=${encodeURIComponent(callerName)}` : '';

	console.log('[JAMBONZ] Main menu - digits:', payload.digits);

	if (payload.digits === '1') {
		console.log('[JAMBONZ] User chose to create appointment');
		const response: JambonzVerb[] = [
			{ verb: 'say', text: 'Parfait! Dites-moi les détails de votre rendez-vous. Par exemple: avec qui, quand, où et pour quelle raison? Après le bip, je vous écoute.' },
			{ verb: 'pause', length: 0.5 },
			{ verb: 'play', url: 'tone:350;w=0.2' },
			{
				verb: 'gather',
				input: ['speech'],
				actionHook: `${baseUrl}/api/jambonz?action=process-booking${callerParams}`,
				timeout: 30,
				minBargeinWordCount: 5,
				finishOnKey: '#',
				speechTimeout: 3
			}
		];
		return res.status(200).json(response);
	}

	if (payload.digits === '2') {
		console.log('[JAMBONZ] User chose to cancel appointment');

		let events: CalendarEvent[] = [];
		try {
			events = JSON.parse(decodeURIComponent(eventsParam));
		} catch (e) {
			console.log('[JAMBONZ] Could not parse events');
		}

		if (events.length === 0) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Je ne vois aucun rendez-vous dans votre agenda. Souhaitez-vous en créer un? Tapez 1 pour oui, 0 pour raccrocher.' },
				{
					verb: 'gather',
					input: ['digits'],
					numDigits: 1,
					actionHook: `${baseUrl}/api/jambonz?action=main-menu${callerParams}`,
					timeout: 10
				}
			];
			return res.status(200).json(response);
		}

		let eventListText = 'Voici vos rendez-vous. ';
		events.forEach((event, index) => {
			const dateText = formatDateForSpeech(event.start);
			eventListText += `Tapez ${index + 1} pour ${event.name} le ${dateText}. `;
		});
		eventListText += 'Tapez 0 si vous ne voulez plus annuler.';

		const contextData = encodeURIComponent(JSON.stringify({ events, callerId, callerName }));

		const response: JambonzVerb[] = [
			{ verb: 'say', text: eventListText },
			{
				verb: 'gather',
				input: ['digits'],
				numDigits: 1,
				actionHook: `${baseUrl}/api/jambonz?action=select-event-cancel&data=${contextData}`,
				timeout: 15,
				say: { text: 'Quel rendez-vous souhaitez-vous annuler?' }
			}
		];
		return res.status(200).json(response);
	}

	const response: JambonzVerb[] = [
		{ verb: 'say', text: 'Je n\'ai pas compris votre choix. Tapez 1 pour créer un rendez-vous, ou 2 pour annuler.' },
		{
			verb: 'gather',
			input: ['digits'],
			numDigits: 1,
			actionHook: `${baseUrl}/api/jambonz?action=main-menu${callerParams}&events=${eventsParam}`,
			timeout: 10
		}
	];
	res.status(200).json(response);
}

async function handleSelectEventToCancel(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Select event to cancel, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { events } = data;
		const choice = parseInt(payload.digits || '0');

		if (choice === 0) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'D\'accord, je n\'annule rien. Y a-t-il autre chose que je puisse faire pour vous? Merci et à bientôt!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const selectedEvent = events[choice - 1];
		if (!selectedEvent) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Ce choix n\'est pas valide. Veuillez rappeler pour réessayer. Au revoir!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const dateText = formatDateForSpeech(selectedEvent.start);
		const confirmData = encodeURIComponent(JSON.stringify({ event_id: selectedEvent.id, eventName: selectedEvent.name }));

		const response: JambonzVerb[] = [
			{ verb: 'say', text: `Vous souhaitez annuler ${selectedEvent.name} prévu le ${dateText}. Tapez 1 pour confirmer la suppression, ou 0 pour annuler.` },
			{
				verb: 'gather',
				input: ['digits'],
				numDigits: 1,
				actionHook: `${baseUrl}/api/jambonz?action=confirm-delete&data=${confirmData}`,
				timeout: 10
			}
		];
		res.status(200).json(response);
	} catch (error) {
		console.error('[JAMBONZ] Error in select event:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Une erreur est survenue. Au revoir.' },
			{ verb: 'hangup' }
		]);
	}
}

async function handleConfirmDelete(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;

	console.log('[JAMBONZ] Confirm delete, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { event_id, eventName } = data;

		if (payload.digits !== '1') {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'D\'accord, l\'annulation est annulée. Votre rendez-vous est maintenu. Merci et à bientôt!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		console.log('[JAMBONZ] Deleting event:', event_id);
		const deleteResponse = await fetch('https://treeporteur-n8n.fr/webhook/DeleteCalendarEvent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ event_id }),
		});

		if (deleteResponse.ok) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: `C'est fait! Le rendez-vous ${eventName} a été supprimé avec succès. Merci de votre confiance et à bientôt!` },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const response: JambonzVerb[] = [
			{ verb: 'say', text: 'Désolé, une erreur s\'est produite lors de la suppression. Un conseiller vous recontactera. Au revoir!' },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);
	} catch (error) {
		console.error('[JAMBONZ] Error in confirm delete:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Erreur technique. Au revoir.' },
			{ verb: 'hangup' }
		]);
	}
}

const SIMILARITY_THRESHOLD = 0.4;
const PERFECT_MATCH_THRESHOLD = 0.95;

async function handleProcessBooking(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Process booking - call_sid:', payload.call_sid);

	const baseUrl = getBaseUrl();
	const callerId = req.query.caller_id as string || '';
	const callerName = req.query.caller_name as string || '';
	const callerParams = callerId ? `&caller_id=${callerId}&caller_name=${encodeURIComponent(callerName)}` : '';

	if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
		const transcript = payload.speech.alternatives[0].transcript;
		console.log('[JAMBONZ] Booking details received:', transcript);

		try {
			const eventInfo = await extractEventInfoFromTranscript(transcript);
			console.log('[JAMBONZ] Extracted event info:', eventInfo);

			if (!eventInfo.start) {
				const response: JambonzVerb[] = [
					{ verb: 'say', text: 'Je n\'ai pas bien compris la date et l\'heure. Pouvez-vous répéter avec la date et l\'heure du rendez-vous?' },
					{
						verb: 'gather',
						input: ['speech'],
						actionHook: `${baseUrl}/api/jambonz?action=process-booking${callerParams}`,
						timeout: 15,
						say: { text: 'Je vous écoute.' }
					}
				];
				return res.status(200).json(response);
			}

			const participantMatches: ParticipantMatch[] = [];

			console.log('[JAMBONZ] === CONTACT MATCHING START ===');
			console.log('[JAMBONZ] Names to match:', eventInfo.names);
			console.log('[JAMBONZ] Thresholds - SIMILARITY:', SIMILARITY_THRESHOLD, 'PERFECT:', PERFECT_MATCH_THRESHOLD);

			if (eventInfo.names.length > 0) {
				const vectorResults = await matchMultipleContactsParallel(eventInfo.names);

				for (const [inputName, matches] of Array.from(vectorResults.entries())) {
					console.log(`[JAMBONZ] --- Matching "${inputName}" ---`);
					console.log(`[JAMBONZ] Raw results (${matches.length} found):`);
					matches.slice(0, 5).forEach((m, i) => {
						console.log(`[JAMBONZ]   ${i + 1}. "${m.name}" (id: ${m.contact_id}) - score: ${m.similarity.toFixed(4)}`);
					});

					const filteredMatches = matches.filter(m => m.similarity >= SIMILARITY_THRESHOLD);
					console.log(`[JAMBONZ] After threshold filter (>= ${SIMILARITY_THRESHOLD}): ${filteredMatches.length} matches`);

					if (filteredMatches.length === 0) {
						console.log(`[JAMBONZ] DECISION: UNMATCHED - No match above threshold`);
						participantMatches.push({
							input_name: inputName,
							status: 'unmatched',
							partner_id: null,
							matched_name: null,
							score: 0,
							candidates: [],
						});
					} else if (filteredMatches[0].similarity >= PERFECT_MATCH_THRESHOLD) {
						console.log(`[JAMBONZ] DECISION: MATCHED - Perfect match with "${filteredMatches[0].name}" (score: ${filteredMatches[0].similarity.toFixed(4)})`);
						participantMatches.push({
							input_name: inputName,
							status: 'matched',
							partner_id: filteredMatches[0].contact_id,
							matched_name: filteredMatches[0].name,
							score: filteredMatches[0].similarity,
							candidates: [],
						});
					} else {
						console.log(`[JAMBONZ] DECISION: AMBIGUOUS - Best match "${filteredMatches[0].name}" (score: ${filteredMatches[0].similarity.toFixed(4)}) below perfect threshold`);
						participantMatches.push({
							input_name: inputName,
							status: 'ambiguous',
							partner_id: null,
							matched_name: null,
							score: filteredMatches[0].similarity,
							candidates: filteredMatches.slice(0, 3).map(m => ({
								partner_id: m.contact_id,
								name: m.name,
								score: m.similarity,
								email: m.metadata?.email,
								phone: m.metadata?.phone,
							})),
						});
					}
				}
			}
			console.log('[JAMBONZ] === CONTACT MATCHING END ===');

			const eventData = {
				start: eventInfo.start,
				stop: eventInfo.stop || eventInfo.start?.replace(/\d{2}:\d{2}$/, (match) => {
					const [h, m] = match.split(':').map(Number);
					return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
				}),
				location: eventInfo.location || '',
				name: eventInfo.reason || 'Rendez-vous',
				description: eventInfo.reason || '',
			};

			const agendaResult = {
				event: eventData,
				participants: participantMatches,
				transcript,
			};

			const unmatched = participantMatches.filter(p => p.status === 'unmatched');
			if (unmatched.length > 0) {
				const target = unmatched[0];
				console.log('[JAMBONZ] Unmatched participant:', target.input_name);

				const contextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					agendaResult,
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Je ne trouve pas ${target.input_name} dans mes contacts. Pour créer ce contact, veuillez taper son numéro de téléphone commençant par les chiffres du pays, puis appuyez sur dièse.` },
					{
						verb: 'gather',
						input: ['digits'],
						finishOnKey: '#',
						timeout: 20,
						actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${contextData}`,
						say: { text: 'J\'attends le numéro.' }
					}
				];
				return res.status(200).json(response);
			}

			const ambiguous = participantMatches.filter(p => p.status === 'ambiguous');
			if (ambiguous.length > 0) {
				const target = ambiguous[0];
				console.log('[JAMBONZ] Ambiguous match:', target.input_name);

				let confirmText = `Pour ${target.input_name}, j'ai trouvé plusieurs correspondances. `;
				target.candidates.forEach((c, i) => {
					const details = c.email || c.phone ? ` (${c.email || c.phone})` : '';
					confirmText += `Tapez ${i + 1} pour ${c.name}${details}. `;
				});
				confirmText += 'Tapez 0 si aucun ne correspond.';

				const contextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					candidates: target.candidates,
					agendaResult,
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: confirmText },
					{
						verb: 'gather',
						input: ['digits'],
						numDigits: 1,
						actionHook: `${baseUrl}/api/jambonz?action=confirm-participant&data=${contextData}`,
						timeout: 15,
						say: { text: 'Quel numéro choisissez-vous?' }
					}
				];
				return res.status(200).json(response);
			}

			const matched = participantMatches.filter(p => p.status === 'matched');
			if (matched.length > 0 || eventInfo.names.length === 0) {
				return await proceedToConfirmation(req, res, agendaResult, callerId, callerName);
			}

			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Je n\'ai pas pu identifier les participants. Un conseiller vous recontactera. Au revoir!' },
				{ verb: 'hangup' }
			];
			res.status(200).json(response);

		} catch (error) {
			console.error('[JAMBONZ] Error processing booking:', error);
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Une erreur est survenue. Au revoir.' },
				{ verb: 'hangup' }
			];
			res.status(200).json(response);
		}
		return;
	}

	const response: JambonzVerb[] = [
		{ verb: 'say', text: 'Je n\'ai pas compris. Au revoir.' },
		{ verb: 'hangup' }
	];
	res.status(200).json(response);
}

async function proceedToConfirmation(req: Request, res: Response, agendaResult: any, callerId: string, callerName: string) {
	const baseUrl = getBaseUrl();
	const matched = agendaResult.participants.filter((p: ParticipantMatch) => p.status === 'matched');
	const participantNames = matched.map((p: ParticipantMatch) => p.matched_name).join(' et ') || 'vous-même';
	const dateText = formatDateForSpeech(agendaResult.event.start);
	const location = agendaResult.event.location || 'lieu non précisé';
	const reason = agendaResult.event.name || 'rendez-vous';

	const confirmText = `Récapitulons: ${reason} avec ${participantNames}, le ${dateText}, à ${location}. Est-ce correct? Tapez 1 pour confirmer, ou 0 pour annuler.`;

	const contextData = encodeURIComponent(JSON.stringify({
		agendaResult,
		callerId,
		callerName
	}));

	const response: JambonzVerb[] = [
		{ verb: 'say', text: confirmText },
		{
			verb: 'gather',
			input: ['digits'],
			numDigits: 1,
			actionHook: `${baseUrl}/api/jambonz?action=final-confirmation&data=${contextData}`,
			timeout: 10
		}
	];
	res.status(200).json(response);
}

async function handleFinalConfirmation(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Final confirmation, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { agendaResult, callerId } = data;

		if (payload.digits !== '1') {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'D\'accord, la réservation est annulée. N\'hésitez pas à rappeler. Au revoir!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const matched = agendaResult.participants.filter((p: ParticipantMatch) => p.status === 'matched');
		const participantIds = matched.map((p: ParticipantMatch) => p.partner_id as number);
		if (callerId) participantIds.unshift(parseInt(callerId));

		console.log('[JAMBONZ] Checking availability for:', participantIds, agendaResult.event.start);

		const checkResponse = await fetch('https://treeporteur-n8n.fr/webhook/check-availability', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contact_ids: participantIds,
				start: agendaResult.event.start,
				stop: agendaResult.event.stop,
			}),
		});

		if (checkResponse.ok) {
			const checkResult = await checkResponse.json() as AvailabilityCheckResult;
			console.log('[JAMBONZ] Availability result:', checkResult);

			if (checkResult.start && checkResult.start !== agendaResult.event.start) {
				const newDateText = formatDateForSpeech(checkResult.start);
				const contextData = encodeURIComponent(JSON.stringify({
					agendaResult: {
						...agendaResult,
						event: { ...agendaResult.event, start: checkResult.start, stop: checkResult.stop }
					},
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Le créneau demandé n'est pas disponible. Je vous propose le ${newDateText} à la place. Tapez 1 pour accepter, ou 0 pour annuler.` },
					{
						verb: 'gather',
						input: ['digits'],
						numDigits: 1,
						actionHook: `${baseUrl}/api/jambonz?action=final-confirmation&data=${contextData}`,
						timeout: 10
					}
				];
				return res.status(200).json(response);
			}
		}

		// Create the event - partner_id is always 3, caller is included in partner_ids
		const webhookPayload = {
			partner_id: 3,
			start: agendaResult.event.start,
			stop: agendaResult.event.stop,
			partner_ids: participantIds, // includes callerId via unshift above
			location: agendaResult.event.location || '',
			name: agendaResult.event.name || 'Rendez-vous',
			description: agendaResult.event.description || '',
		};

		console.log('[JAMBONZ] Creating event:', webhookPayload);

		const createResponse = await fetch('https://treeporteur-n8n.fr/webhook/CreateCalendarEvent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(webhookPayload),
		});

		if (createResponse.ok) {
			const participantNames = matched.map((p: ParticipantMatch) => p.matched_name).join(' et ');
			const dateText = formatDateForSpeech(agendaResult.event.start);

			const response: JambonzVerb[] = [
				{ verb: 'say', text: `Excellent! Votre rendez-vous avec ${participantNames} le ${dateText} est confirmé. Merci de votre confiance et à très bientôt!` },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const response: JambonzVerb[] = [
			{ verb: 'say', text: 'Désolé, une erreur s\'est produite lors de la création. Un conseiller vous recontactera. Au revoir!' },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);

	} catch (error) {
		console.error('[JAMBONZ] Error in final confirmation:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Erreur technique. Au revoir.' },
			{ verb: 'hangup' }
		]);
	}
}

async function handleCreateMissingContact(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Create missing contact, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { targetName, agendaResult, callerId } = data;
		let phoneNumber = payload.digits;

		if (!phoneNumber) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Je n\'ai pas reçu de numéro. Nous allons passer ce contact.' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		if (!phoneNumber.startsWith('+')) {
			phoneNumber = '+' + phoneNumber;
		}

		console.log('[JAMBONZ] Creating contact:', targetName, phoneNumber);

		const createResponse = await fetch('https://treeporteur-n8n.fr/webhook/CreateNewContact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: targetName,
				phone: phoneNumber,
				email: null,
			}),
		});

		if (createResponse.ok) {
			const result = await createResponse.json();
			const newContactId = result.id || result.partner_id || result.contact?.id;

			console.log('[JAMBONZ] Contact created with ID:', newContactId);

			const updatedParticipants = agendaResult.participants.map((p: ParticipantMatch) => {
				if (p.input_name === targetName) {
					return {
						...p,
						status: 'matched',
						partner_id: newContactId,
						matched_name: targetName,
					};
				}
				return p;
			});
			agendaResult.participants = updatedParticipants;

			const unmatched = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'unmatched');
			const ambiguous = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'ambiguous');

			if (unmatched.length > 0) {
				const target = unmatched[0];
				const nextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					agendaResult,
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Contact ${targetName} créé! Passons à ${target.input_name}. Veuillez taper son numéro de téléphone.` },
					{
						verb: 'gather',
						input: ['digits'],
						finishOnKey: '#',
						actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${nextData}`,
						timeout: 20
					}
				];
				return res.status(200).json(response);
			}

			if (ambiguous.length > 0) {
				const target = ambiguous[0];
				let confirmText = `Contact créé! Pour ${target.input_name}, `;
				target.candidates.forEach((c: any, i: number) => {
					confirmText += `tapez ${i + 1} pour ${c.name}. `;
				});
				confirmText += 'Tapez 0 si aucun ne correspond.';

				const nextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					candidates: target.candidates,
					agendaResult,
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: confirmText },
					{
						verb: 'gather',
						input: ['digits'],
						numDigits: 1,
						actionHook: `${baseUrl}/api/jambonz?action=confirm-participant&data=${nextData}`,
						timeout: 10
					}
				];
				return res.status(200).json(response);
			}

			return await proceedToConfirmation(req, res, agendaResult, callerId, '');
		}

		const response: JambonzVerb[] = [
			{ verb: 'say', text: 'Erreur lors de la création du contact. Un conseiller prendra le relais. Au revoir!' },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);

	} catch (error) {
		console.error('[JAMBONZ] Error create missing contact:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Erreur technique. Au revoir.' },
			{ verb: 'hangup' }
		]);
	}
}

async function handleConfirmParticipant(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Confirm participant, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { targetName, candidates, agendaResult, callerId } = data;

		const choice = parseInt(payload.digits || '0');

		if (choice === 0) {
			const contextData = encodeURIComponent(JSON.stringify({
				targetName,
				agendaResult,
				callerId
			}));

			const response: JambonzVerb[] = [
				{ verb: 'say', text: `D'accord, ${targetName} n'est pas dans la liste. Veuillez taper son numéro de téléphone pour créer le contact.` },
				{
					verb: 'gather',
					input: ['digits'],
					finishOnKey: '#',
					actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${contextData}`,
					timeout: 20
				}
			];
			return res.status(200).json(response);
		}

		const selected = candidates[choice - 1];
		if (!selected) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Choix invalide. Veuillez rappeler. Au revoir!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		const updatedParticipants = agendaResult.participants.map((p: ParticipantMatch) => {
			if (p.input_name === targetName) {
				return {
					...p,
					status: 'matched',
					partner_id: selected.partner_id,
					matched_name: selected.name,
				};
			}
			return p;
		});
		agendaResult.participants = updatedParticipants;

		const ambiguous = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'ambiguous');
		const unmatched = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'unmatched');

		if (ambiguous.length > 0) {
			const target = ambiguous[0];
			let confirmText = `Noté! Pour ${target.input_name}, `;
			target.candidates.forEach((c: any, i: number) => {
				confirmText += `tapez ${i + 1} pour ${c.name}. `;
			});
			confirmText += 'Tapez 0 si aucun ne correspond.';

			const nextData = encodeURIComponent(JSON.stringify({
				targetName: target.input_name,
				candidates: target.candidates,
				agendaResult,
				callerId
			}));

			const response: JambonzVerb[] = [
				{ verb: 'say', text: confirmText },
				{
					verb: 'gather',
					input: ['digits'],
					numDigits: 1,
					actionHook: `${baseUrl}/api/jambonz?action=confirm-participant&data=${nextData}`,
					timeout: 10
				}
			];
			return res.status(200).json(response);
		}

		if (unmatched.length > 0) {
			const target = unmatched[0];
			const nextData = encodeURIComponent(JSON.stringify({
				targetName: target.input_name,
				agendaResult,
				callerId
			}));

			const response: JambonzVerb[] = [
				{ verb: 'say', text: `C'est noté! Pour ${target.input_name}, je ne trouve pas de fiche. Veuillez entrer son numéro de téléphone.` },
				{
					verb: 'gather',
					input: ['digits'],
					finishOnKey: '#',
					actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${nextData}`,
					timeout: 20
				}
			];
			return res.status(200).json(response);
		}

		return await proceedToConfirmation(req, res, agendaResult, callerId, '');

	} catch (error) {
		console.error('[JAMBONZ] Error confirm participant:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Erreur technique. Au revoir.' },
			{ verb: 'hangup' }
		]);
	}
}

function handleCallStatus(req: Request, res: Response) {
	console.log('[JAMBONZ] Call status update:', req.body.call_sid);
	res.status(200).json({ received: true });
}

// ============================================================
// Main Handler
// ============================================================

export async function jambonzHandler(req: Request, res: Response) {
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	if (req.method !== 'POST') {
		return res.status(200).json([
			{ verb: 'say', text: 'Méthode non autorisée.' },
			{ verb: 'hangup' }
		]);
	}

	try {
		const action = (req.query.action as string) || 'welcome';
		console.log('[JAMBONZ] Handling action:', action);

		switch (action) {
			case 'welcome': return await handleWelcome(req, res);
			case 'main-menu': return handleMainMenu(req, res);
			case 'select-event-cancel': return await handleSelectEventToCancel(req, res);
			case 'confirm-delete': return await handleConfirmDelete(req, res);
			case 'process-booking': return await handleProcessBooking(req, res);
			case 'create-missing-contact': return await handleCreateMissingContact(req, res);
			case 'confirm-participant': return await handleConfirmParticipant(req, res);
			case 'final-confirmation': return await handleFinalConfirmation(req, res);
			case 'call-status': return handleCallStatus(req, res);
			default:
				console.log('[JAMBONZ] Unknown action:', action);
				return res.status(200).json([
					{ verb: 'say', text: 'Erreur action inconnue.' },
					{ verb: 'hangup' }
				]);
		}
	} catch (error: any) {
		console.error('[JAMBONZ] Error:', error);
		res.status(200).json([
			{ verb: 'say', text: 'Une erreur technique est survenue.' },
			{ verb: 'hangup' }
		]);
	}
}
