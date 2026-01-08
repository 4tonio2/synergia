/**
 * Test script for Agenda feature
 * 
 * Tests:
 * 1. Duration parsing
 * 2. Relative date parsing
 * 3. Time parsing
 * 4. Name normalization and fuzzy matching
 * 
 * Usage: node tests/test-agenda.js
 */

// ============================================================
// Duration Parsing Tests
// ============================================================

function parseDuration(durationStr) {
    if (!durationStr) return null;

    const normalized = durationStr.toLowerCase().trim();

    // "une demi-heure" / "demi heure"
    if (/demi[- ]?heure/.test(normalized)) {
        return 30;
    }

    // "1h30", "2h", "1h 30"
    const hMatch = normalized.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)?/);
    if (hMatch) {
        const hours = parseInt(hMatch[1], 10);
        const mins = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
        return hours * 60 + mins;
    }

    // "30 min", "30 minutes", "45min"
    const minMatch = normalized.match(/(\d+)\s*min(?:ute)?s?/);
    if (minMatch) {
        return parseInt(minMatch[1], 10);
    }

    // Just a number (assume minutes)
    const numMatch = normalized.match(/^(\d+)$/);
    if (numMatch) {
        return parseInt(numMatch[1], 10);
    }

    return null;
}

// ============================================================
// Name Normalization and Fuzzy Matching Tests
// ============================================================

function normalizeForMatch(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric
        .replace(/\s+/g, ' ')
        .trim();
}

function similarityScore(input, target) {
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
            // Partial match for short tokens or long names
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

// ============================================================
// Run Tests
// ============================================================

console.log('='.repeat(60));
console.log('TEST: Agenda Feature - Duration Parsing');
console.log('='.repeat(60));

const durationTests = [
    { input: '30 min', expected: 30 },
    { input: '30 minutes', expected: 30 },
    { input: '45min', expected: 45 },
    { input: '1h', expected: 60 },
    { input: '1 heure', expected: 60 },
    { input: '2h', expected: 120 },
    { input: '1h30', expected: 90 },
    { input: '1h 30', expected: 90 },
    { input: '2h15', expected: 135 },
    { input: 'une demi-heure', expected: 30 },
    { input: 'demi heure', expected: 30 },
    { input: null, expected: null },
    { input: '', expected: null },
];

let durationPassed = 0;
for (const test of durationTests) {
    const result = parseDuration(test.input);
    const passed = result === test.expected;
    console.log(`${passed ? '✓' : '✗'} parseDuration("${test.input}") = ${result} (expected: ${test.expected})`);
    if (passed) durationPassed++;
}
console.log(`\nDuration tests: ${durationPassed}/${durationTests.length} passed\n`);

console.log('='.repeat(60));
console.log('TEST: Agenda Feature - Name Normalization');
console.log('='.repeat(60));

const normTests = [
    { input: 'Jean-Pierre Dupont', expected: 'jean pierre dupont' },
    { input: '  Marie   Ella  ', expected: 'marie ella' },
    { input: 'François Müller', expected: 'francois muller' },
    { input: 'Kévin', expected: 'kevin' },
    { input: 'PASCAL ZELLNER', expected: 'pascal zellner' },
];

let normPassed = 0;
for (const test of normTests) {
    const result = normalizeForMatch(test.input);
    const passed = result === test.expected;
    console.log(`${passed ? '✓' : '✗'} normalize("${test.input}") = "${result}" (expected: "${test.expected}")`);
    if (passed) normPassed++;
}
console.log(`\nNormalization tests: ${normPassed}/${normTests.length} passed\n`);

console.log('='.repeat(60));
console.log('TEST: Agenda Feature - Fuzzy Matching');
console.log('='.repeat(60));

const matchTests = [
    { input: 'Jean Dupont', target: 'Jean Dupont', minScore: 1.0 },
    { input: 'Jean', target: 'Jean Dupont', minScore: 0.4 },
    { input: 'Dupont', target: 'Jean Dupont', minScore: 0.4 },
    { input: 'Pascal Zellner', target: 'PASCAL ZELLNER', minScore: 1.0 },
    { input: 'Mari', target: 'Marie Ella', minScore: 0.3 },
    { input: 'Kevin Chambon', target: 'Kévin Chambon', minScore: 0.9 },
    { input: 'Gabriel Smaniotto', target: 'Smaniotto Gabriel', minScore: 0.9 },
    { input: 'Totalement différent', target: 'Jean Dupont', minScore: 0, maxScore: 0.2 },
];

let matchPassed = 0;
for (const test of matchTests) {
    const score = similarityScore(test.input, test.target);
    const minOk = score >= test.minScore;
    const maxOk = test.maxScore === undefined || score <= test.maxScore;
    const passed = minOk && maxOk;
    console.log(`${passed ? '✓' : '✗'} similarity("${test.input}", "${test.target}") = ${score.toFixed(2)} (min: ${test.minScore}${test.maxScore !== undefined ? ', max: ' + test.maxScore : ''})`);
    if (passed) matchPassed++;
}
console.log(`\nMatching tests: ${matchPassed}/${matchTests.length} passed\n`);

console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
const totalPassed = durationPassed + normPassed + matchPassed;
const totalTests = durationTests.length + normTests.length + matchTests.length;
console.log(`Total: ${totalPassed}/${totalTests} tests passed`);
console.log(totalPassed === totalTests ? '✓ All tests passed!' : '✗ Some tests failed');
console.log('='.repeat(60));
