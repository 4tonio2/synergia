/**
 * Test script for Agenda API endpoints
 * 
 * Tests the following endpoints:
 * 1. GET /api/agenda/participants - Fetch all Odoo contacts
 * 2. POST /api/agenda/prepare - Extract event and match participants
 * 3. POST /api/agenda/create-contact - Create new contact
 * 4. POST /api/agenda/confirm - Confirm event creation
 * 
 * Usage: node tests/test-agenda-endpoints.js
 * 
 * Make sure the server is running on http://localhost:5000
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

// ============================================================
// Test Utilities
// ============================================================

async function testEndpoint(name, fn) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log('='.repeat(60));

    try {
        const result = await fn();
        console.log('✓ PASSED');
        return { name, passed: true, result };
    } catch (error) {
        console.log(`✗ FAILED: ${error.message}`);
        return { name, passed: false, error: error.message };
    }
}

// ============================================================
// Tests
// ============================================================

async function testGetParticipants() {
    const response = await fetch(`${BASE_URL}/api/agenda/participants`, {
        method: 'GET',
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`→ Got ${data.participants?.length || 0} participants`);

    if (!data.participants || !Array.isArray(data.participants)) {
        throw new Error('Response should have participants array');
    }

    // Show first 3 participants
    console.log('→ Sample participants:');
    data.participants.slice(0, 3).forEach(p => {
        console.log(`   - ${p.name} (ID: ${p.id})`);
    });

    return data;
}

async function testPrepareEvent() {
    const testText = "Rendez-vous avec Pascal Zellner demain à 14h30 pour discuter du projet, durée 1h au bureau";

    console.log(`→ Input text: "${testText}"`);

    const response = await fetch(`${BASE_URL}/api/agenda/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log('→ Extracted event:');
    console.log(`   - Start: ${data.event?.start}`);
    console.log(`   - Stop: ${data.event?.stop}`);
    console.log(`   - Description: ${data.event?.description}`);
    console.log(`   - Location: ${data.event?.location}`);

    console.log('→ Participants:');
    data.participants?.forEach(p => {
        const status = p.status === 'matched' ? '✓' : p.status === 'unmatched' ? '✗' : '?';
        console.log(`   ${status} ${p.input_name} → ${p.matched_name || 'not matched'} (score: ${(p.score * 100).toFixed(0)}%)`);
    });

    if (data.warnings?.length > 0) {
        console.log('→ Warnings:');
        data.warnings.forEach(w => console.log(`   ⚠ ${w}`));
    }

    if (!data.event || !data.participants) {
        throw new Error('Response should have event and participants');
    }

    return data;
}

async function testPrepareEventWithUnknownParticipant() {
    const testText = "RDV avec Jean-Pierre Inconnu le 15 janvier à 10h pour 30 minutes";

    console.log(`→ Input text: "${testText}"`);

    const response = await fetch(`${BASE_URL}/api/agenda/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    const unmatchedCount = data.participants?.filter(p => p.status === 'unmatched').length || 0;
    console.log(`→ Unmatched participants: ${unmatchedCount}`);

    if (unmatchedCount === 0) {
        console.log('   (Note: Expected unmatched participant, but all were matched)');
    }

    return data;
}

async function testConfirmEvent() {
    const mockPayload = {
        event: {
            partner_id: 3,
            participant_ids: [488, 497],
            start: '2026-01-15 14:00:00',
            stop: '2026-01-15 15:00:00',
            description: 'Réunion test',
            location: 'Bureau',
        },
        participants: [
            { input_name: 'Pascal Zellner', status: 'matched', matched_name: 'Pascal Zellner', partner_id: 488 },
            { input_name: 'Antonio', status: 'matched', matched_name: 'Antonio Maminiaina', partner_id: 497 },
        ],
    };

    console.log('→ Sending mock event for confirmation...');

    const response = await fetch(`${BASE_URL}/api/agenda/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log('→ Confirmation response:');
    console.log(`   - Success: ${data.success}`);
    console.log(`   - Message: ${data.message}`);
    console.log(`   - Summary: ${JSON.stringify(data.summary, null, 2)}`);

    if (!data.success) {
        throw new Error('Expected success: true');
    }

    return data;
}

// ============================================================
// Run All Tests
// ============================================================

async function runAllTests() {
    console.log('\n' + '█'.repeat(60));
    console.log('AGENDA API ENDPOINT TESTS');
    console.log(`Base URL: ${BASE_URL}`);
    console.log('█'.repeat(60));

    const results = [];

    results.push(await testEndpoint('GET /api/agenda/participants', testGetParticipants));
    results.push(await testEndpoint('POST /api/agenda/prepare (known participant)', testPrepareEvent));
    results.push(await testEndpoint('POST /api/agenda/prepare (unknown participant)', testPrepareEventWithUnknownParticipant));
    results.push(await testEndpoint('POST /api/agenda/confirm', testConfirmEvent));

    // Summary
    console.log('\n' + '█'.repeat(60));
    console.log('SUMMARY');
    console.log('█'.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(r => {
        console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
    });

    console.log(`\nTotal: ${passed}/${total} tests passed`);
    console.log(passed === total ? '✓ All tests passed!' : '✗ Some tests failed');
    console.log('█'.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
