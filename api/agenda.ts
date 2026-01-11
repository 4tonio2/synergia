import type { VercelRequest, VercelResponse } from '@vercel/node';

// Note: legacy OpenAI and Supabase-based extraction/matching removed. All logic now uses external n8n webhooks.

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

// Legacy ContactMatch type removed along with vector matching.

interface OdooCalendarNLPResult {
	intent: 'create' | 'update' | 'cancel';
	event: {
		name?: string;
		start?: string; // "YYYY-MM-DD HH:MM"
		stop?: string;  // "YYYY-MM-DD HH:MM"
		location?: string;
		participants?: string[];
		description?: string | null;
	};
	event_match?: {
		original_start?: string;
		original_stop?: string;
		keywords?: string[];
		participants?: string[];
	};
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
// Legacy vector search removed. Participant matching now relies on n8n contact lookup webhook.

// ============================================================
// LLM extraction removed; external NLP webhook is the single source of truth.

// ============================================================
// Action Handlers
// ============================================================

async function handlePrepare(req: VercelRequest, res: VercelResponse) {
	const { text } = req.body as { text?: string };

	if (!text || !text.trim()) {
		return res.status(400).json({ error: 'Le texte est requis' });
	}

	console.log('[AGENDA] Preparing event from text via external NLP:', text.substring(0, 100) + '...');

	// Collect warnings to return to client without failing
	const warnings: string[] = [];

	// 1. Call external NLP webhook to analyze intent and event
	let nlpItems: OdooCalendarNLPResult[] = [];
	try {
		const resp = await fetch('https://treeporteur-n8n.fr/webhook/odoo-calendar-nlp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: text })
		});
		if (!resp.ok) {
			const body = await resp.text().catch(() => '');
			console.error('[AGENDA] odoo-calendar-nlp error:', resp.status, body);
			warnings.push('Erreur NLP calendrier');
			nlpItems = [];
		}
		if (resp.ok) {
			const raw = await resp.json();
			if (Array.isArray(raw)) {
				nlpItems = raw as OdooCalendarNLPResult[];
			} else if (raw && typeof raw === 'object') {
				nlpItems = [raw as OdooCalendarNLPResult];
			} else {
				console.warn('[AGENDA] NLP webhook returned unexpected payload type');
				warnings.push('Réponse NLP inattendue');
				nlpItems = [];
			}
		}
	} catch (err: any) {
		console.error('[AGENDA] NLP webhook call failed:', err);
		warnings.push('Erreur lors de l\'analyse du texte');
		nlpItems = [];
	}

	const first = Array.isArray(nlpItems) && nlpItems.length > 0 ? nlpItems[0] : null;
	if (!first) {
		// Return minimal payload with warnings so client can display modal gracefully
		warnings.push('Analyse NLP externe vide');
		return res.json({
			to_validate: false,
			intent: 'create',
			event_match: {},
			event: {
				partner_id: 3,
				participant_ids: [],
				start: '',
				stop: '',
				description: 'Rendez-vous',
				location: '',
			},
			participants: [],
			warnings,
			raw_extraction: {},
		});
	}

	const intent = first.intent;
	const eventFromNLP = first.event || {};
	const eventMatch = first.event_match || {};

	// Normalize start/stop; default stop +1h if missing
	let start = eventFromNLP.start || '';
	let stop = eventFromNLP.stop || '';
	// warnings already collected above

	if (start && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(start)) {
		start = start + ':00';
	}
	if (stop && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(stop)) {
		stop = stop + ':00';
	}
	if (!stop && start) {
		const [datePart, timePart] = start.split(' ');
		if (timePart) {
			stop = `${datePart} ${addMinutesToTime(timePart, 60)}`; // default +1h
			warnings.push('Durée non spécifiée => durée par défaut 60 min');
		}
	}
	if (!start) warnings.push('Date/heure non spécifiée');
	if (!eventFromNLP.location) warnings.push('Lieu non spécifié');

	// 2. Identify participants via external contact-lookup webhook using names
	const names = (eventMatch.participants && Array.isArray(eventMatch.participants)) ? eventMatch.participants : (eventFromNLP.participants || []);
	let lookupResults: Array<{ found: boolean; contact?: { id: string | number; name: string; email?: string | null; phone?: string | null } }>; 
	lookupResults = [];
	try {
		if (names.length > 0) {
			const resp = await fetch('https://treeporteur-n8n.fr/webhook/odoo-contact-lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: names })
			});
			if (!resp.ok) {
				const body = await resp.text().catch(() => '');
				console.error('[AGENDA] odoo-contact-lookup error:', resp.status, body);
				warnings.push('Recherche de participants échouée');
			} else {
				lookupResults = await resp.json() as Array<{ found: boolean; contact?: { id: string | number; name: string; email?: string | null; phone?: string | null } }>;
			}
		}
	} catch (err) {
		console.error('[AGENDA] Contact lookup failed:', err);
		warnings.push('Recherche de participants échouée');
	}

	// 3. Build ParticipantMatch array from lookup results
	const participantMatches = (names || []).map((input_name, idx) => {
		const item = lookupResults[idx];
		if (item && item.found && item.contact) {
			const partnerId = typeof item.contact.id === 'string' ? parseInt(item.contact.id, 10) : item.contact.id;
			return {
				input_name,
				status: 'matched' as const,
				partner_id: partnerId,
				matched_name: item.contact.name,
				score: 1,
				candidates: [],
				needs_contact_creation: false,
				proposed_contact: { name: input_name, email: item.contact.email || null, phone: item.contact.phone || null },
			};
		}
		return {
			input_name,
			status: 'unmatched' as const,
			partner_id: null,
			matched_name: null,
			score: 0,
			candidates: [],
			needs_contact_creation: true,
			proposed_contact: { name: input_name, email: null, phone: null },
		};
	});

	const matchedIds = participantMatches
		.filter((p) => p.status === 'matched' && p.partner_id)
		.map((p) => p.partner_id as number);

	// 3.1 When intent is update/cancel, try to identify the original event now to carry its ID forward
	let foundEvent: any = null;
	let foundEventId: number | string | null = null;
	if ((intent === 'update' || intent === 'cancel') && eventMatch.original_start && matchedIds.length > 0) {
		try {
			const resp = await fetch('https://treeporteur-n8n.fr/webhook/FindEvent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ original_start: eventMatch.original_start, participant_ids: matchedIds }),
			});
			if (resp.ok) {
				const raw = await resp.json().catch(() => ({}));
				// n8n FindEvent returns an array like: [{ found: true, event: { id, name, start, stop, ... } }]
				if (Array.isArray(raw) && raw.length > 0) {
					const firstItem = raw[0];
					if (firstItem && firstItem.event) {
						foundEvent = firstItem.event;
						// id may be string; keep as-is or cast to number if numeric
						const idVal = firstItem.event.id;
						foundEventId = idVal ?? null;
					} else {
						foundEvent = raw;
						foundEventId = null;
					}
				} else if (raw && typeof raw === 'object') {
					foundEvent = raw;
					foundEventId = (raw as any)?.event_id ?? (raw as any)?.id ?? null;
				}
				if (!foundEventId) {
					warnings.push('ID de l\'événement original non trouvé');
				}
			} else {
				const body = await resp.text().catch(() => '');
				console.warn('[AGENDA] FindEvent non-ok:', resp.status, body);
				warnings.push('Identification de l\'événement à modifier échouée');
			}
		} catch (e) {
			console.error('[AGENDA] FindEvent error:', e);
			warnings.push('Erreur lors de l\'identification de l\'événement');
		}
	}

	// 4. Build response payload for modal
	res.json({
		to_validate: true,
		intent,
		event_match: eventMatch,
		event: {
			partner_id: 3,
			participant_ids: matchedIds,
			start: start || '',
			stop: stop || '',
			name: (eventFromNLP.name ?? eventFromNLP.description ?? 'Rendez-vous') || 'Rendez-vous',
			description: (eventFromNLP.description ?? '') || '',
			location: eventFromNLP.location || '',
			event_id: foundEventId ?? undefined,
		},
		participants: participantMatches,
		warnings,
		raw_extraction: first,
		found_event: foundEvent,
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

	// Prepare payload for n8n webhook (include title as name, plus location & description)
	const webhookPayload = {
		name: event.name || event.description || 'Rendez-vous',
		start: event.start,
		stop: event.stop,
		partner_id: 3,
		partner_ids: event.participant_ids || [],
		location: event.location || '',
		description: event.description || '',
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
			title: event.name || event.description || 'Rendez-vous',
			start: event.start,
			stop: event.stop,
			location: event.location || 'Non spécifié',
			participants: participantNames,
			participant_ids: event.participant_ids || [],
		},
	});
}

async function handleFindEvent(req: VercelRequest, res: VercelResponse) {
	const { original_start, participant_ids } = req.body as { original_start?: string; participant_ids?: number[] };

	if (!original_start || !participant_ids || participant_ids.length === 0) {
		return res.status(400).json({ error: 'original_start et participant_ids sont requis' });
	}

	console.log('[AGENDA] Finding event:', { original_start, participant_ids });

	const response = await fetch('https://treeporteur-n8n.fr/webhook/FindEvent', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ original_start, participant_ids }),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('[AGENDA] FindEvent error:', response.status, body);
		return res.status(502).json({ error: 'Erreur lors de l\'identification de l\'événement', details: body });
	}

	const data = await response.json().catch(() => ({}));
	res.json(data);
}

async function handleUpdateEvent(req: VercelRequest, res: VercelResponse) {
	const { event_id, name, start, stop, location, description } = req.body as {
		event_id?: number | string;
		name?: string;
		start?: string;
		stop?: string;
		location?: string;
		description?: string | null;
	};

	if (!event_id) {
		return res.status(400).json({ error: "event_id requis pour la mise à jour" });
	}

	// Default stop +1h if missing and start provided
	let computedStart = start || '';
	let computedStop = stop || '';
	if (computedStart && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(computedStart)) {
		computedStart = computedStart + ':00';
	}
	if (computedStop && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(computedStop)) {
		computedStop = computedStop + ':00';
	}
	if (!computedStop && computedStart) {
		const [datePart, timePart] = computedStart.split(' ');
		if (timePart) {
			computedStop = `${datePart} ${addMinutesToTime(timePart, 60)}`;
		}
	}

	const payload = {
		event_id,
		name,
		start: computedStart || start,
		stop: computedStop || stop,
		location,
		description,
	};

	console.log('[AGENDA] Updating event:', payload);

	const response = await fetch('https://treeporteur-n8n.fr/webhook/update-event', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('[AGENDA] update-event error:', response.status, body);
		return res.status(502).json({ error: 'Erreur lors de la mise à jour de l\'événement', details: body });
	}

	const data = await response.json().catch(() => ({}));
	res.json({ success: true, odoo_response: data });
}

async function handleDeleteEvent(req: VercelRequest, res: VercelResponse) {
	const { event_id } = req.body as { event_id?: number | string };
	if (!event_id) {
		return res.status(400).json({ error: 'event_id requis pour la suppression' });
	}

	console.log('[AGENDA] Deleting event:', { event_id });

	const response = await fetch('https://treeporteur-n8n.fr/webhook/DeleteCalendarEvent', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ event_id }),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('[AGENDA] DeleteCalendarEvent error:', response.status, body);
		return res.status(502).json({ error: 'Erreur lors de la suppression de l\'événement', details: body });
	}

	const data = await response.json().catch(() => ({}));
	res.json({ success: true, odoo_response: data });
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

			case 'find-event':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for find-event' });
				}
				return await handleFindEvent(req, res);

			case 'update-event':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for update-event' });
				}
				return await handleUpdateEvent(req, res);

			case 'delete-event':
				if (req.method !== 'POST') {
					return res.status(405).json({ error: 'Method not allowed for delete-event' });
				}
				return await handleDeleteEvent(req, res);

			default:
				return res.status(400).json({
					error: `Action inconnue: ${action}`,
					availableActions: ['prepare', 'confirm', 'check-availability', 'participants', 'create-contact', 'find-event', 'update-event', 'delete-event']
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
