import type { VercelRequest, VercelResponse } from '@vercel/node';

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

interface ParticipantMatch {
	input_name: string;
	status: 'matched' | 'unmatched' | 'ambiguous';
	partner_id: number | null;
	matched_name: string | null;
	score: number;
	candidates: Array<{ partner_id: number; name: string; score: number }>;
}

interface AvailabilityCheckResult {
	success: boolean;
	attempts: number;
	start?: string;
	stop?: string;
	message?: string;
}

interface AgendaResult {
	event?: {
		description?: string;
		start?: string;
		end?: string;
		stop?: string;
	};
	participants?: ParticipantMatch[];
	raw_extraction?: any;
}

// ============================================================
// Helpers
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
 * Identify caller by phone number using n8n AuthContact webhook
 */
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

// ============================================================
// Handlers
// ============================================================

async function handleWelcome(req: VercelRequest, res: VercelResponse) {
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

function handleIntent(req: VercelRequest, res: VercelResponse) {
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

async function handleProcessBooking(req: VercelRequest, res: VercelResponse) {
	const payload = req.body as JambonzWebhookPayload;
	console.log('[JAMBONZ] Process booking - call_sid:', payload.call_sid);

	const baseUrl = getBaseUrl();
	const callerId = req.query.caller_id as string || '';
	const callerName = req.query.caller_name as string || '';

	if (payload.reason === 'speechDetected' && payload.speech?.alternatives?.length) {
		const transcript = payload.speech.alternatives[0].transcript;
		console.log('[JAMBONZ] Booking details received:', transcript);

		try {
			// Call agenda API to prepare booking (now includes vector search)
			console.log('[JAMBONZ] Calling agenda API to prepare booking...');
			const agendaResponse = await fetch(`${baseUrl}/api/agenda`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'prepare', text: transcript })
			});

			if (!agendaResponse.ok) {
				throw new Error(`Agenda API error: ${agendaResponse.status}`);
			}

			const agendaResult = await agendaResponse.json() as AgendaResult;
			console.log('[JAMBONZ] Agenda prepare result:', JSON.stringify(agendaResult));

			const participants = agendaResult.participants || [];
			const matched = participants.filter(p => p.status === 'matched');
			const ambiguous = participants.filter(p => p.status === 'ambiguous');
			const unmatched = participants.filter(p => p.status === 'unmatched');

			// 1. Handle Unmatched - Ask for phone number
			if (unmatched.length > 0) {
				const target = unmatched[0]; // Handle one by one
				console.log('[JAMBONZ] Unmatched participant:', target.input_name);

				const contextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					transcript, // Keep original transcript to retry later
					agendaResult, // Keep current state
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Je ne trouve pas de contact pour ${target.input_name}. Pour créer ce contact, veuillez taper son numéro de téléphone suivi de dièse.` },
					{
						verb: 'gather',
						input: ['digits'],
						finishOnKey: '#',
						timeout: 15,
						actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${contextData}`,
						say: { text: "J'attends le numéro." }
					}
				];
				return res.status(200).json(response);
			}

			// 2. Handle Ambiguous - Ask for confirmation
			if (ambiguous.length > 0) {
				const target = ambiguous[0];
				console.log('[JAMBONZ] Ambiguous match:', target.input_name);

				let confirmText = `Pour ${target.input_name}, voulez-vous dire `;
				const candidatesList = target.candidates.map((c, i) => `${i + 1} pour ${c.name}`).join(', ');
				confirmText += candidatesList + '? Tapez le numéro correspondant.';

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
						timeout: 10,
						say: { text: 'Je vous écoute.' }
					}
				];
				return res.status(200).json(response);
			}

			// 3. All Matched - Check Availability first
			if (matched.length > 0 && agendaResult.event) {
				const participantIds = matched.map(p => p.partner_id as number);
				if (callerId) participantIds.unshift(parseInt(callerId));

				console.log('[JAMBONZ] Checking availability for:', participantIds, agendaResult.event.start);

				const checkResponse = await fetch(`${baseUrl}/api/agenda`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'check-availability',
						contact_ids: participantIds,
						start: agendaResult.event.start,
						stop: agendaResult.event.stop || agendaResult.event.end // handle both namings
					})
				});

				if (checkResponse.ok) {
					const checkResult = await checkResponse.json() as AvailabilityCheckResult;
					console.log('[JAMBONZ] Check result:', checkResult);

					if (checkResult.attempts && checkResult.attempts > 0) {
						// CONFLICT DETECTED
						const response: JambonzVerb[] = [
							{ verb: 'say', text: "Désolé, ce créneau n'est pas disponible. Veuillez me proposer une autre heure." },
							{
								verb: 'gather',
								input: ['speech'],
								actionHook: `${baseUrl}/api/jambonz?action=process-booking${callerParams}`, // Loop back to process booking with new speech
								timeout: 15,
								say: { text: 'Je vous écoute.' }
							}
						];
						return res.status(200).json(response);
					}
				}

				// AVAILABLE - Proceed to Create Event
				console.log('[JAMBONZ] Creating event with participants:', participantIds);

				const confirmResponse = await fetch(`${baseUrl}/api/agenda`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'confirm',
						event: agendaResult.event,
						participants: matched,
						skipAvailabilityCheck: true // Checked above
					})
				});

				if (confirmResponse.ok) {
					const participantNames = matched.map(p => p.matched_name).join(' et ');
					const successResponse: JambonzVerb[] = [
						{ verb: 'say', text: `Parfait! Votre rendez-vous avec ${participantNames} a été créé pour le ${formatDateForSpeech(agendaResult.event?.start || '')}. Merci et à bientôt!` },
						{ verb: 'hangup' }
					];
					return res.status(200).json(successResponse);
				}
			}

			// Fallback (no participants found or error)
			const response: JambonzVerb[] = [
				{ verb: 'say', text: "J'ai bien noté la date, mais je n'ai pas compris avec qui vous voulez rendez-vous. Un conseiller vous rappellera." },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);

		} catch (error) {
			console.error('[JAMBONZ] Error processing booking:', error);
			const response: JambonzVerb[] = [
				{ verb: 'say', text: 'Une erreur est survenue. Au revoir.' },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}
	}

	const response: JambonzVerb[] = [
		{ verb: 'say', text: "Je n'ai pas compris. Au revoir." },
		{ verb: 'hangup' }
	];
	res.status(200).json(response);
}

// Handler for creating a missing contact from IVR input
async function handleCreateMissingContact(req: VercelRequest, res: VercelResponse) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Create missing contact, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { targetName, transcript, agendaResult, callerId } = data;
		const phoneNumber = payload.digits;

		if (!phoneNumber) {
			// No input
			const response: JambonzVerb[] = [
				{ verb: 'say', text: "Je n'ai pas reçu de numéro. Nous allons annuler la création." },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		console.log('[JAMBONZ] Creating contact:', targetName, phoneNumber);

		// Create contact via Agenda API
		const createResponse = await fetch(`${baseUrl}/api/agenda`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'create-contact',
				name: targetName,
				phone: phoneNumber
			})
		});

		if (createResponse.ok) {
			const result = await createResponse.json();
			const newContactId = result.contact?.id || result.contact?.partner_id;

			console.log('[JAMBONZ] Contact created with ID:', newContactId);

			// Now we need to update the agendaResult with this new match
			// Find the participant in agendaResult and update status
			const updatedParticipants = agendaResult.participants.map((p: ParticipantMatch) => {
				if (p.input_name === targetName) {
					return {
						...p,
						status: 'matched',
						partner_id: newContactId,
						matched_name: targetName
					};
				}
				return p;
			});

			agendaResult.participants = updatedParticipants;

			// Recursively call handleProcessBooking logic (conceptually) 
			// But since we are in a new request, we should just check if we are done or have more issues.

			// We can re-use the logic by constructing a fake request or just copy-pasting the check logic?
			// Better/Simpler: Redirect to a helper or just check the next step here.

			// Check if there are MORE unmatched/ambiguous
			const unmatched = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'unmatched');
			const ambiguous = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'ambiguous');

			if (unmatched.length > 0) {
				// Loop back to solve NEXT unmatched
				const target = unmatched[0];
				const nextData = encodeURIComponent(JSON.stringify({
					targetName: target.input_name,
					transcript,
					agendaResult,
					callerId
				}));

				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Contact créé. Passons à ${target.input_name}. Veuillez taper son numéro de téléphone.` },
					{
						verb: 'gather',
						input: ['digits'],
						finishOnKey: '#',
						actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${nextData}`,
						timeout: 15
					}
				];
				return res.status(200).json(response);
			}

			if (ambiguous.length > 0) {
				// Handle next ambiguous
				const target = ambiguous[0];
				let confirmText = `Contact créé. Pour ${target.input_name}, voulez-vous dire `;
				const candidatesList = target.candidates.map((c: any, i: number) => `${i + 1} pour ${c.name}`).join(', ');
				confirmText += candidatesList + '?';

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

			// All done! Check Availability & Create event.
			if (agendaResult.event) {
				const participantIds = updatedParticipants.map((p: ParticipantMatch) => p.partner_id as number);
				if (callerId) participantIds.unshift(parseInt(callerId));

				// CHECK AVAILABILITY LOOP for contact creation flow too
				const checkResponse = await fetch(`${baseUrl}/api/agenda`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'check-availability',
						contact_ids: participantIds,
						start: agendaResult.event.start,
						stop: agendaResult.event.stop || agendaResult.event.end
					})
				});

				if (checkResponse.ok) {
					const checkResult = await checkResponse.json() as AvailabilityCheckResult;
					if (checkResult.attempts && checkResult.attempts > 0) {
						// CONFLICT DETECTED
						const callerParams = callerId ? `&caller_id=${callerId}` : '';
						const response: JambonzVerb[] = [
							{ verb: 'say', text: "Tout est bon pour les contacts, mais ce créneau n'est pas disponible. Veuillez me proposer une autre heure." },
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

				const confirmResponse = await fetch(`${baseUrl}/api/agenda`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'confirm',
						event: agendaResult.event,
						participants: updatedParticipants,
						skipAvailabilityCheck: true
					})
				});

				if (confirmResponse.ok) {
					const participantNames = updatedParticipants.map((p: ParticipantMatch) => p.matched_name).join(' et ');
					const response: JambonzVerb[] = [
						{ verb: 'say', text: `C'est noté. Votre rendez-vous avec ${participantNames} est confirmé. Merci!` },
						{ verb: 'hangup' }
					];
					return res.status(200).json(response);
				}
			}
		}

		// Error fallback
		const response: JambonzVerb[] = [
			{ verb: 'say', text: "Il y a eu un problème lors de la création du contact. Un conseiller prendra le relais." },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);

	} catch (error) {
		console.error('[JAMBONZ] Error create missing contact:', error);
		const response: JambonzVerb[] = [
			{ verb: 'say', text: "Erreur technique. Au revoir." },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);
	}
}

// Handler for confirming ambiguous participant
async function handleConfirmParticipant(req: VercelRequest, res: VercelResponse) {
	const payload = req.body as JambonzWebhookPayload;
	const dataParam = req.query.data as string;
	const baseUrl = getBaseUrl();

	console.log('[JAMBONZ] Confirm participant, digits:', payload.digits);

	try {
		const data = JSON.parse(decodeURIComponent(dataParam));
		const { targetName, candidates, agendaResult, callerId } = data;

		const choice = parseInt(payload.digits || '0');
		const selected = candidates[choice - 1];

		if (!selected) {
			const response: JambonzVerb[] = [
				{ verb: 'say', text: "Choix invalide. Veuillez rappeler." },
				{ verb: 'hangup' }
			];
			return res.status(200).json(response);
		}

		// Update agendaResult
		const updatedParticipants = agendaResult.participants.map((p: ParticipantMatch) => {
			if (p.input_name === targetName) {
				return {
					...p,
					status: 'matched',
					partner_id: selected.partner_id,
					matched_name: selected.name
				};
			}
			return p;
		});
		agendaResult.participants = updatedParticipants;

		// Check for remaining issues
		const ambiguous = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'ambiguous');
		const unmatched = updatedParticipants.filter((p: ParticipantMatch) => p.status === 'unmatched');

		if (ambiguous.length > 0) {
			// Next ambiguous
			const target = ambiguous[0];
			let confirmText = `Noté. Pour ${target.input_name}, voulez-vous dire `;
			confirmText += target.candidates.map((c: any, i: number) => `${i + 1} pour ${c.name}`).join(', ') + '?';

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
			// Redirect to create missing contact
			const target = unmatched[0];
			const nextData = encodeURIComponent(JSON.stringify({
				targetName: target.input_name,
				transcript: '', // Not needed here really
				agendaResult,
				callerId
			}));

			const response: JambonzVerb[] = [
				{ verb: 'say', text: `C'est noté. Pour ${target.input_name}, je ne trouve pas de fiche. Veuillez entrer son numéro de téléphone.` },
				{
					verb: 'gather',
					input: ['digits'],
					finishOnKey: '#',
					actionHook: `${baseUrl}/api/jambonz?action=create-missing-contact&data=${nextData}`,
					timeout: 15
				}
			];
			return res.status(200).json(response);
		}

		// All done - Check Availability & Confirm
		if (agendaResult.event) {
			const participantIds = updatedParticipants.map((p: ParticipantMatch) => p.partner_id as number);
			if (callerId) participantIds.unshift(parseInt(callerId));

			// CHECK AVAILABILITY
			const checkResponse = await fetch(`${baseUrl}/api/agenda`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'check-availability',
					contact_ids: participantIds,
					start: agendaResult.event.start,
					stop: agendaResult.event.stop || agendaResult.event.end
				})
			});

			if (checkResponse.ok) {
				const checkResult = await checkResponse.json() as AvailabilityCheckResult;
				if (checkResult.attempts && checkResult.attempts > 0) {
					// CONFLICT DETECTED
					const callerParams = callerId ? `&caller_id=${callerId}` : '';
					const response: JambonzVerb[] = [
						{ verb: 'say', text: "Tout est bon pour les participants, mais le créneau n'est pas disponible. Veuillez me proposer une autre heure." },
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

			const confirmResponse = await fetch(`${baseUrl}/api/agenda`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'confirm',
					event: agendaResult.event,
					participants: updatedParticipants,
					skipAvailabilityCheck: true
				})
			});

			if (confirmResponse.ok) {
				const participantNames = updatedParticipants.map((p: ParticipantMatch) => p.matched_name).join(' et ');
				const response: JambonzVerb[] = [
					{ verb: 'say', text: `Entendu. Votre rendez-vous avec ${participantNames} est validé. Merci, au revoir!` },
					{ verb: 'hangup' }
				];
				return res.status(200).json(response);
			}
		}

		const response: JambonzVerb[] = [
			{ verb: 'say', text: "Erreur lors de la validation. Désolé." },
			{ verb: 'hangup' }
		];
		res.status(200).json(response);

	} catch (error) {
		console.error('[JAMBONZ] Error confirm participant:', error);
		res.status(200).json([
			{ verb: 'say', text: "Erreur technique." },
			{ verb: 'hangup' }
		]);
	}
}

function handleCallStatus(req: VercelRequest, res: VercelResponse) {
	console.log('[JAMBONZ] Call status update:', req.body.call_sid);
	res.status(200).json({ received: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	setCorsHeaders(res);

	if (req.method === 'OPTIONS') {
		res.status(200).end();
		return;
	}

	if (req.method !== 'POST') {
		return res.status(200).json([{ verb: 'say', text: 'Méthode non autorisée.' }, { verb: 'hangup' }]);
	}

	try {
		const action = (req.query.action as string) || 'welcome';
		console.log('[JAMBONZ] Action:', action);

		switch (action) {
			case 'welcome': return await handleWelcome(req, res);
			case 'handle-intent': return handleIntent(req, res);
			case 'process-booking': return await handleProcessBooking(req, res);
			case 'create-missing-contact': return await handleCreateMissingContact(req, res);
			case 'confirm-participant': return await handleConfirmParticipant(req, res);
			case 'call-status': return handleCallStatus(req, res);
			default:
				console.log('[JAMBONZ] Unknown action:', action);
				return res.status(200).json([{ verb: 'say', text: 'Erreur action inconnue.' }, { verb: 'hangup' }]);
		}
	} catch (error: any) {
		console.error('[JAMBONZ] Error:', error);
		res.status(200).json([{ verb: 'say', text: 'Erreur technique globale.' }, { verb: 'hangup' }]);
	}
}
