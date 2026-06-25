import type { DailyReview, JournalReflection, JournalSummarySuggestion } from './types';

const tones = new Set<JournalSummarySuggestion['tone']>([
  'neutral',
  'hopeful',
  'difficult',
  'reflective',
  'uncertain',
]);

export const JOURNAL_SUMMARY_SYSTEM_PROMPT =
  'You summarize a user-approved private journal entry. Return strict JSON only. Do not diagnose, invent events, judge the user, or promise financial outcomes.';

export function buildJournalSummaryPrompt(entry: string): string {
  return `Suggest a short title, concise summary, up to five safe lowercase tags, and tone for this journal entry:\n\n${entry.slice(
    0,
    8_000,
  )}`;
}

export function parseJournalSummarySuggestion(raw: string): JournalSummarySuggestion | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return null;
  }
  const title = boundedString(parsed.title, 120);
  const summary = boundedString(parsed.summary, 1_000);
  if (!title || !summary || !tones.has(parsed.tone as JournalSummarySuggestion['tone'])) {
    return null;
  }
  return {
    title,
    summary,
    tags: boundedStringArray(parsed.tags, 5, 32).map(normalizeTag).filter(Boolean),
    tone: parsed.tone as JournalSummarySuggestion['tone'],
  };
}

export function parseJournalReflection(raw: string): JournalReflection | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return null;
  }
  const acknowledgement = boundedString(parsed.acknowledgement, 400);
  if (!acknowledgement) {
    return null;
  }
  return {
    acknowledgement,
    themes: boundedStringArray(parsed.themes, 5, 80),
    questions: boundedStringArray(parsed.questions, 3, 160),
    possibleNextSteps: boundedStringArray(parsed.possibleNextSteps, 4, 160),
  };
}

export function parseDailyReview(raw: string): DailyReview | null {
  const parsed = parseJsonObject(raw);
  const date = parsed ? boundedString(parsed.date, 40) : null;
  if (!parsed || !date) {
    return null;
  }
  return {
    date,
    highlights: boundedStringArray(parsed.highlights, 5, 160),
    difficulties: boundedStringArray(parsed.difficulties, 5, 160),
    recurringThemes: boundedStringArray(parsed.recurringThemes, 5, 160),
    processWins: boundedStringArray(parsed.processWins, 5, 160),
    possibleFocusForTomorrow: boundedStringArray(parsed.possibleFocusForTomorrow, 5, 160),
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /diagnos/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function boundedStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => boundedString(item, maxChars))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function normalizeTag(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}
