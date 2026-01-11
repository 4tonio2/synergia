/**
 * Jambonz IVR Service for local Express server
 * This is a copy of api/jambonz.ts adapted for Express
 */

import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================
// Clients
// ============================================================

const supabase = createClient(
	process.env.SUPABASE_URL || '',
	process.env.SUPABASE_ANON_KEY || ''
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

interface ContactMatch {
	id: number;
	contact_id: number;
	name: string;
	content: string;
	metadata: any;
	similarity: number;
}

interface AgendaResult {
	event?: {
		description?: string;
		start?: string;
		end?: string;
	};
	participants?: Array<{
		input_name: string;
		status: string;
		partner_id: number | null;
		matched_name: string | null;
		score: number;
	}>;
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

async function identifyCallerByPhone(phone: string): Promise<CallerInfo | null> {
	console.log('[JAMBONZ] Identifying caller by phone:', phone);
	try {
		const response = await fetch('https://treeporteur-n8n.fr/webhook/AuthContact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier: phone }),
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

async function generateEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
	});
	return response.data[0].embedding;
}

async function matchContactByVector(name: string, matchCount: number = 5): Promise<ContactMatch[]> {
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
		return (data as ContactMatch[]) || [];
	} catch (error) {
		console.error('[JAMBONZ] Error in vector search:', error);
		return [];
	}
}

async function matchMultipleContacts(names: string[]): Promise<Map<string, ContactMatch[]>> {
	console.log('[JAMBONZ] Parallel search for', names.length, 'names:', names);
	const results = new Map<string, ContactMatch[]>();

	const searches = await Promise.all(
		names.map(async (name) => ({
			name,
			matches: await matchContactByVector(name),
		}))
	);

	for (const { name, matches } of searches) {
		results.set(name, matches);
	}

	return results;
}

async function extractNamesFromTranscript(transcript: string): Promise<string[]> {
	console.log('[JAMBONZ] Extracting names from transcript:', transcript);
	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `Tu es un assistant qui extrait les noms de personnes mentionnées dans une demande de rendez-vous.
Retourne UNIQUEMENT un tableau JSON des noms de personnes mentionnées.
- Inclus le prénom et/ou nom de famille mentionnés
- Ignore les mots comme "avec", "et", "le docteur", "monsieur", "madame"
- Si aucun nom n'est mentionné, retourne []

Exemples:
- "rendez-vous avec Marc demain" → ["Marc"]
- "avec Jean Dupont et Marie" → ["Jean Dupont", "Marie"]
- "voir le docteur Martin à 14h" → ["Martin"]
- "demain à 10h" → []`
				},
				{
					role: 'user',
					content: transcript
				}
			],
			temperature: 0,
			max_tokens: 200,
		});

		const content = response.choices[0]?.message?.content || '[]';
		console.log('[JAMBONZ] GPT extracted names:', content);

		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const names = JSON.parse(jsonMatch[0]) as string[];
			console.log('[JAMBONZ] Parsed names:', names);
			return names.filter(n => typeof n === 'string' && n.trim().length > 0);
		}

		return [];
	} catch (error) {
		console.error('[JAMBONZ] Error extracting names:', error);
		return [];
	}
}

const SIMILARITY_THRESHOLD = 0.85;

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

// ============================================================
// Handlers
// ============================================================

async function handleWelcome(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Welcome - New call:', payload.call_sid, 'from:', payload.from);

	const baseUrl = getBaseUrl();
	const caller = await identifyCallerByPhone(payload.from);
	const greeting = getGreeting();
	const callerName = caller?.name ? ` ${caller.name}` : '';
	const callerIdParam = caller?.id ? `&caller_id=${caller.id}&caller_name=${encodeURIComponent(caller.name)}` : '';

	const welcomeText = caller?.name
		? `${greeting}${callerName}. Bienvenue chez Synergia. Souhaitez-vous prendre un rendez-vous?`
		: `${greeting}. Bienvenue chez Synergia. Souhaitez-vous prendre un rendez-vous?`;

	const response: JambonzVerb[] = [
		{ verb: 'pause', length: 0.5 },
		{
			verb: 'gather',
			input: ['speech'],
			actionHook: `${baseUrl}/api/jambonz?action=handle-intent${callerIdParam}`,
			timeout: 10,
			say: { text: welcomeText }
		}
	];

	console.log('[JAMBONZ] Sending welcome response, caller:', caller?.name || 'unknown');
	res.status(200).json(response);
}

function handleIntent(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Handle intent - call_sid:', payload.call_sid, 'reason:', payload.reason);

	const baseUrl = getBaseUrl();
	const callerId = req.query.caller_id as string || '';
	const callerName = req.query.caller_name as string || '';
	const callerParams = callerId ? `&caller_id=${callerId}&caller_name=${encodeURIComponent(callerName)}` : '';

	if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
		const transcript = payload.speech.alternatives[0].transcript.toLowerCase();
		console.log('[JAMBONZ] Speech detected:', transcript);

		const positiveKeywords = ['oui', 'ouais', 'okay', 'ok', 'd\'accord', 'je veux', 'je voudrais', 'absolument', 'bien sûr', 'volontiers'];
		const isPositive = positiveKeywords.some(kw => transcript.includes(kw));

		if (isPositive) {
			console.log('[JAMBONZ] Positive intent detected - asking for booking details');
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Très bien! Veuillez me donner les détails de votre rendez-vous. Par exemple: avec qui, quel jour, et à quelle heure?' },
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
	}

	console.log('[JAMBONZ] Negative intent or timeout - ending call');
	const response: JambonzVerb[] = [
		{ verb: 'say', text: 'D\'accord. Si vous avez besoin d\'aide, n\'hésitez pas à rappeler. Au revoir!' },
		{ verb: 'hangup' }
	];
	res.status(200).json(response);
}

async function handleProcessBooking(req: Request, res: Response) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Process booking - call_sid:', payload.call_sid);

	const baseUrl = getBaseUrl();
	const callerId = req.query.caller_id as string || '';

	if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
		const transcript = payload.speech.alternatives[0].transcript;
		console.log('[JAMBONZ] Booking details received:', transcript);

		try {
			// Extract names via GPT
			const extractedNames = await extractNamesFromTranscript(transcript);
			console.log('[JAMBONZ] GPT extracted names:', extractedNames);

			// Get event details from agenda API
			const agendaResponse = await fetch(`${baseUrl}/api/agenda`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'prepare', text: transcript })
			});

			const agendaResult = agendaResponse.ok ? await agendaResponse.json() as AgendaResult : null;
			console.log('[JAMBONZ] Agenda result:', agendaResult);

			if (extractedNames.length > 0) {
				const vectorResults = await matchMultipleContacts(extractedNames);
				const matchedParticipants: Array<{ name: string; contact_id: number; contact_name: string }> = [];
				const ambiguousNames: Array<{ name: string; candidates: ContactMatch[] }> = [];

				for (const [inputName, matches] of Array.from(vectorResults.entries())) {
					if (matches.length > 0) {
						const bestMatch = matches[0];
						console.log('[JAMBONZ] Best match for', inputName, ':', bestMatch.name, 'score:', bestMatch.similarity);

						if (bestMatch.similarity >= SIMILARITY_THRESHOLD) {
							matchedParticipants.push({
								name: inputName,
								contact_id: bestMatch.contact_id,
								contact_name: bestMatch.name
							});
						} else {
							ambiguousNames.push({ name: inputName, candidates: matches.slice(0, 3) });
						}
					}
				}

				// If ambiguous names, ask DTMF confirmation
				if (ambiguousNames.length > 0) {
					const firstAmbiguous = ambiguousNames[0];
					let confirmText = `Pour ${firstAmbiguous.name}, voulez-vous dire `;
					const candidatesList = firstAmbiguous.candidates.map((c, i) => `${i + 1} pour ${c.name}`).join(', ');
					confirmText += candidatesList + '? Tapez le numéro correspondant.';

					const candidatesData = encodeURIComponent(JSON.stringify({
						inputName: firstAmbiguous.name,
						candidates: firstAmbiguous.candidates.map(c => ({ id: c.contact_id, name: c.name })),
						matchedParticipants,
						remainingAmbiguous: ambiguousNames.slice(1),
						agendaResult,
						callerId
					}));

					const response: JambonzVerb[] = [
						{ verb: 'say', text: confirmText },
						{
							verb: 'gather',
							input: ['digits'],
							numDigits: 1,
							actionHook: `${baseUrl}/api/jambonz?action=confirm-participant&data=${candidatesData}`,
							timeout: 10,
							say: { text: 'Je vous écoute.' }
						}
					];
					return res.status(200).json(response);
				}

				// All matched - create event
				if (matchedParticipants.length > 0 && agendaResult?.event) {
					const participantNames = matchedParticipants.map(p => p.contact_name).join(' et ');
					const successResponse: JambonzVerb[] = [
						{ verb: 'say', text: `Parfait! Votre rendez-vous avec ${participantNames} a été créé pour le ${formatDateForSpeech(agendaResult.event.start || '')}. Merci et à bientôt!` },
						{ verb: 'hangup' }
					];
					return res.status(200).json(successResponse);
				}
			}

			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'J\'ai noté votre demande, mais je n\'ai pas pu confirmer tous les détails. Un conseiller vous recontactera.' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);

		} catch (error: any) {
			console.error('[JAMBONZ] Error processing booking:', error);
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Désolé, une erreur est survenue. Au revoir!' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}
	}

	const response: JambonzVerb[] = [
		{ verb: 'say', text: 'Je n\'ai pas compris. Veuillez rappeler. Au revoir!' },
		{ verb: 'hangup' }
	];
	res.status(200).json(response);
}

function handleCallStatus(req: Request, res: Response) {
	console.log('[JAMBONZ] Call status update:', req.body.call_sid, req.body.call_status);
	res.status(200).json({ received: true });
}

// ============================================================
// Main Handler
// ============================================================

export async function jambonzHandler(req: Request, res: Response) {
	// CORS
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
			case 'welcome':
				return await handleWelcome(req, res);
			case 'handle-intent':
				return handleIntent(req, res);
			case 'process-booking':
				return await handleProcessBooking(req, res);
			case 'call-status':
				return handleCallStatus(req, res);
			default:
				console.log('[JAMBONZ] Unknown action:', action);
				return res.status(200).json([
					{ verb: 'say', text: 'Bienvenue chez Synergia.' },
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
