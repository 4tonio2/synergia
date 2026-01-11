/**
 * Test script for IVR vector matching
 * Run with: node tests/test-ivr-matching.js
 */

const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5000';

async function testExtractNames() {
	console.log('\n=== Test 1: Name Extraction ===\n');

	const testCases = [
		'rendez-vous avec Jean Huges lauret demain à 14h',
		'avec Marc et Pierre vendredi',
		'voir le docteur Martin lundi matin',
		'demain à 10h', // No names
	];

	for (const transcript of testCases) {
		console.log(`Input: "${transcript}"`);

		const response = await fetch(`${WEBAPP_URL}/api/jambonz?action=process-booking`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				call_sid: 'test-' + Date.now(),
				from: '+33612345678',
				reason: 'speechDetected',
				speech: {
					alternatives: [{ transcript, confidence: 0.95 }]
				}
			})
		});

		const result = await response.json();
		console.log('Response:', JSON.stringify(result, null, 2).substring(0, 300));
		console.log('---\n');
	}
}

async function testCallerIdentification() {
	console.log('\n=== Test 2: Caller Identification ===\n');

	const response = await fetch(`${WEBAPP_URL}/api/jambonz?action=welcome`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			call_sid: 'test-' + Date.now(),
			from: '+261349792961', // Replace with a known phone number
			to: '+33600000000',
			direction: 'inbound'
		})
	});

	const result = await response.json();
	console.log('Welcome response:', JSON.stringify(result, null, 2));
}

// Run tests
(async () => {
	try {
		await testCallerIdentification();
		await testExtractNames();
		console.log('\n✅ Tests completed!');
	} catch (error) {
		console.error('❌ Test error:', error);
	}
})();
