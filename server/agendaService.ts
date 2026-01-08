/**
 * Agenda Service - Handles event extraction, participant matching, and Odoo integration
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface OdooParticipant {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
}

export interface ExtractedEvent {
  participants: string[];
  start: string | null;
  stop: string | null;
  duration_minutes: number | null;
  description: string;
  location: string;
}

export interface ParticipantMatch {
  input_name: string;
  status: 'matched' | 'unmatched' | 'ambiguous';
  partner_id: number | null;
  matched_name: string | null;
  score: number;
  candidates: Array<{ partner_id: number; name: string; score: number }>;
  needs_contact_creation: boolean;
  proposed_contact: { name: string; email: string | null; phone: string | null };
}

export interface AgendaValidationPayload {
  to_validate: boolean;
  event: {
    partner_id: number;
    participant_ids: number[];
    start: string;
    stop: string;
    description: string;
    location: string;
  };
  participants: ParticipantMatch[];
  warnings: string[];
  raw_extraction: ExtractedEvent;
}

// ============================================================
// Date/Time Utilities
// ============================================================

/**
 * Parse duration strings like "30 min", "1h", "1 heure", "une demi-heure"
 */
export function parseDuration(durationStr: string): number | null {
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

/**
 * Parse relative dates like "demain", "mardi prochain" into ISO date strings
 * @param dateStr - The relative date string
 * @param referenceDate - The reference date (defaults to now)
 */
export function parseRelativeDate(dateStr: string, referenceDate: Date = new Date()): string | null {
  if (!dateStr) return null;

  const normalized = dateStr.toLowerCase().trim();
  const now = new Date(referenceDate);

  // "aujourd'hui"
  if (/aujourd'?hui/.test(normalized)) {
    return formatDateOnly(now);
  }

  // "demain"
  if (/demain/.test(normalized)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateOnly(tomorrow);
  }

  // "après-demain"
  if (/apr[eè]s[- ]?demain/.test(normalized)) {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return formatDateOnly(dayAfter);
  }

  // Day names: "lundi", "mardi", etc. with optional "prochain"
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  for (let i = 0; i < dayNames.length; i++) {
    if (normalized.includes(dayNames[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysAhead = targetDay - currentDay;

      // If the day has passed or is today, go to next week
      if (daysAhead <= 0 || normalized.includes('prochain')) {
        daysAhead += 7;
      }

      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      return formatDateOnly(targetDate);
    }
  }

  // Try to parse "le 15 janvier", "15/01", etc.
  const datePatterns = [
    // "le 15 janvier 2026" or "15 janvier"
    /(\d{1,2})\s*(?:er)?\s*([a-zéûô]+)(?:\s+(\d{4}))?/i,
    // "15/01/2026" or "15/01"
    /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/,
  ];

  const months: Record<string, number> = {
    janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11
  };

  // Try French month name format
  const frenchMatch = normalized.match(/(\d{1,2})\s*(?:er)?\s*([a-zéûô]+)(?:\s+(\d{4}))?/i);
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const monthName = frenchMatch[2].toLowerCase();
    const year = frenchMatch[3] ? parseInt(frenchMatch[3], 10) : now.getFullYear();

    if (months[monthName] !== undefined) {
      const result = new Date(year, months[monthName], day);
      return formatDateOnly(result);
    }
  }

  // Try numeric format
  const numMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    let year = numMatch[3] ? parseInt(numMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;

    const result = new Date(year, month, day);
    return formatDateOnly(result);
  }

  return null;
}

/**
 * Parse time strings like "14h", "14h30", "14:30"
 */
export function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const normalized = timeStr.toLowerCase().trim();

  // "14h30", "14h", "9h"
  const hMatch = normalized.match(/(\d{1,2})\s*h\s*(\d{2})?/);
  if (hMatch) {
    const hours = hMatch[1].padStart(2, '0');
    const mins = hMatch[2] || '00';
    return `${hours}:${mins}:00`;
  }

  // "14:30"
  const colonMatch = normalized.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (colonMatch) {
    const hours = colonMatch[1].padStart(2, '0');
    const mins = colonMatch[2];
    const secs = colonMatch[3] || '00';
    return `${hours}:${mins}:${secs}`;
  }

  return null;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format datetime to Odoo format "YYYY-MM-DD HH:MM:SS"
 */
export function formatOdooDatetime(date: string, time: string): string {
  return `${date} ${time}`;
}

/**
 * Add minutes to a time string and return new time string
 */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m, s] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`;
}

// ============================================================
// Fuzzy Matching Utilities
// ============================================================

/**
 * Normalize a string for comparison: lowercase, remove accents, trim, compress spaces
 */
export function normalizeForMatch(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple similarity score based on token overlap (Jaccard-like)
 */
export function similarityScore(input: string, target: string): number {
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

/**
 * Match extracted participant names against Odoo contacts
 */
export function matchParticipants(
  extractedNames: string[],
  odooContacts: OdooParticipant[],
  matchThreshold: number = 0.5,
  ambiguousThreshold: number = 0.1
): ParticipantMatch[] {
  return extractedNames.map(inputName => {
    const scores = odooContacts.map(contact => ({
      partner_id: contact.id,
      name: contact.name,
      score: similarityScore(inputName, contact.name),
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0];
    const secondBest = scores[1];

    // No matches at all
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

    // Check for ambiguity (multiple close matches)
    if (secondBest && secondBest.score > matchThreshold &&
      bestMatch.score - secondBest.score < ambiguousThreshold) {
      return {
        input_name: inputName,
        status: 'ambiguous' as const,
        partner_id: null,
        matched_name: null,
        score: bestMatch.score,
        candidates: scores.filter(s => s.score >= matchThreshold).slice(0, 3),
        needs_contact_creation: false,
        proposed_contact: { name: inputName, email: null, phone: null },
      };
    }

    // Clear match
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

// ============================================================
// LLM Extraction
// ============================================================

const EXTRACTION_PROMPT_TEMPLATE = `Tu es un assistant qui extrait les informations d'un rendez-vous à partir d'une phrase dictée en français.

DATE ET HEURE ACTUELLES: {{CURRENT_DATETIME}}
JOUR DE LA SEMAINE: {{CURRENT_DAY}}

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

export async function extractEventFromText(text: string, currentDate: Date = new Date()): Promise<ExtractedEvent> {
  // Format current date and time for the prompt
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const currentDay = dayNames[currentDate.getDay()];
  const currentDateTime = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

  const prompt = EXTRACTION_PROMPT_TEMPLATE
    .replace('{{CURRENT_DATETIME}}', currentDateTime)
    .replace('{{CURRENT_DAY}}', currentDay);

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

    // Normalize the extracted data
    const participants = Array.isArray(parsed.participants) ? parsed.participants : [];

    let startDate = parsed.start_date || null;
    let startTime = parsed.start_time || null;
    let stop: string | null = null;
    let durationMinutes: number | null = parsed.duration_minutes || null;

    // Parse relative dates
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      startDate = parseRelativeDate(startDate) || startDate;
    }

    // Parse time
    if (startTime && !/^\d{2}:\d{2}/.test(startTime)) {
      const parsed = parseTime(startTime);
      startTime = parsed || startTime;
    } else if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
      startTime = startTime + ':00';
    }

    // Calculate stop time if we have start and duration/end
    if (parsed.end_time) {
      const endParsed = parseTime(parsed.end_time);
      if (endParsed && startDate) {
        stop = `${startDate} ${endParsed}`;
      }
    } else if (durationMinutes && startTime) {
      const endTime = addMinutesToTime(startTime, durationMinutes);
      if (startDate) {
        stop = `${startDate} ${endTime}`;
      }
    }

    // Build start datetime
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
// Main Prepare Function
// ============================================================

export async function prepareAgendaEvent(
  text: string,
  odooContacts: OdooParticipant[],
  currentDate: Date = new Date()
): Promise<AgendaValidationPayload> {
  const warnings: string[] = [];

  // 1. Extract event data from text (pass current date for context)
  const extracted = await extractEventFromText(text, currentDate);

  // 2. Handle missing/default values
  let start = extracted.start;
  let stop = extracted.stop;
  const durationMinutes = extracted.duration_minutes || 60; // Default 60 min

  // If no start date, use today
  if (!start) {
    const today = formatDateOnly(currentDate);
    const hours = currentDate.getHours();
    const mins = currentDate.getMinutes();
    // Round to next 15 minutes
    const roundedMins = Math.ceil(mins / 15) * 15;
    const startTime = `${String(hours).padStart(2, '0')}:${String(roundedMins % 60).padStart(2, '0')}:00`;
    start = `${today} ${startTime}`;
    warnings.push('Date/heure non spécifiée => maintenant');
  }

  // If no stop, calculate from start + duration
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

  // If no location
  if (!extracted.location) {
    warnings.push('Lieu non spécifié');
  }

  // 3. Match participants
  const participantMatches = matchParticipants(extracted.participants, odooContacts);

  // 4. Collect matched participant IDs
  const matchedIds = participantMatches
    .filter(p => p.status === 'matched' && p.partner_id)
    .map(p => p.partner_id as number);

  return {
    to_validate: true,
    event: {
      partner_id: 3, // Always 3 as per requirements
      participant_ids: matchedIds,
      start: start || '',
      stop: stop || '',
      description: extracted.description || 'Rendez-vous',
      location: extracted.location || '',
    },
    participants: participantMatches,
    warnings,
    raw_extraction: extracted,
  };
}
