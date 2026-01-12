import readline from 'readline';

// Configuration
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5000';
const API_URL = `${WEBAPP_URL}/api/jambonz`;

// Types
interface JambonzVerb {
	verb: 'say' | 'gather' | 'hangup' | 'pause';
	text?: string;
	input?: string[];
	actionHook?: string;
	timeout?: number;
	finishOnKey?: string;
	numDigits?: number;
	say?: { text: string };
	length?: number;
}

interface JambonzPayload {
	call_sid: string;
	direction: 'inbound';
	from: string;
	to: string;
	reason?: string;
	speech?: {
		alternatives: Array<{
			transcript: string;
			confidence: number;
		}>;
	};
	digits?: string;
}

// State
const callSid = `sim-${Date.now()}`;
let currentUrl = `${API_URL}?action=welcome`;
let isCallActive = true;

// Setup readline
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
	return new Promise((resolve) => rl.question(query, resolve));
};

async function postToUrl(url: string, payload: any) {
	try {
		// Extract query params from URL if any, as fetch usually treats them part of the URL string
		// but for safety we just pass the full string
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json() as JambonzVerb[];
	} catch (error) {
		console.error('Network error:', error);
		return null;
	}
}

async function handleVerbs(verbs: JambonzVerb[]) {
	if (!verbs || !Array.isArray(verbs)) {
		console.log('No verbs received or invalid format.');
		isCallActive = false;
		return;
	}

	for (const verb of verbs) {
		if (!isCallActive) break;

		switch (verb.verb) {
			case 'say':
				if (verb.text) console.log(`🤖 [SAY]: "${verb.text}"`);
				break;

			case 'pause':
				const seconds = verb.length || 1;
				console.log(`... [PAUSE ${seconds}s] ...`);
				await new Promise(r => setTimeout(r, seconds * 1000));
				break;

			case 'hangup':
				console.log('📞 [HANGUP]');
				isCallActive = false;
				break;

			case 'gather':
				// This is where user interaction happens
				if (verb.say && verb.say.text) {
					console.log(`🤖 [SAY]: "${verb.say.text}"`);
				}

				const inputType = verb.input?.includes('speech') ? 'Speech' : 'Digits';
				const prompt = `👉 [INPUT (${inputType})]: `;

				const userInput = await askQuestion(prompt);

				// Prepare next payload
				const nextPayload: JambonzPayload = {
					call_sid: callSid,
					direction: 'inbound',
					from: 'simulated_user',
					to: 'synergia',
				};

				if (verb.input?.includes('speech')) {
					nextPayload.reason = 'speechDetected';
					nextPayload.speech = {
						alternatives: [{
							transcript: userInput,
							confidence: 0.99
						}]
					};
				} else if (verb.input?.includes('digits')) {
					nextPayload.reason = 'dtmfDetected'; // or whatever standard is
					nextPayload.digits = userInput;
				}

				// The actionHook is usually where we send the result
				if (verb.actionHook) {
					currentUrl = verb.actionHook;
					// Usually actionHook might lack the base domain if relative, but here we expect absolute from our API
					// Note: API returns full URL usually? Let's check api/jambonz.ts
					// Yes: `${baseUrl}/api/jambonz?action=handle-intent${callerIdParam}`

					// Proceed to next step immediately
					const nextResponse = await postToUrl(currentUrl, nextPayload);
					if (nextResponse) {
						await handleVerbs(nextResponse);
					}
					// IMPORTANT: "gather" typically ends the current chain of execution until input provided
					// So we return from this function after handling the next chain
					return;
				}
				break;

			default:
				console.log(`Unknown verb: ${verb.verb}`, verb);
		}
	}
}

async function main() {
	console.log('==========================================');
	console.log('   IVR SIMULATOR (Jambonz Protocol)       ');
	console.log('==========================================');
	console.log(`Target: ${API_URL}`);
	console.log(`Call SID: ${callSid}`);
	console.log('------------------------------------------');

	// Initial Welcome Flow
	const payload: JambonzPayload = {
		call_sid: callSid,
		direction: 'inbound',
		from: '+261349792961', // Fake number for identification logic (might want to prompt for this)
		to: 'synergia'
	};

	const response = await postToUrl(currentUrl, payload);
	if (response) {
		await handleVerbs(response);
	}

	if (!isCallActive) {
		console.log('------------------------------------------');
		console.log('Call ended.');
		process.exit(0);
	}
}

main().catch(console.error);
