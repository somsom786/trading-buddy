import type { Memory, MemoryCategory } from './types';

export type ForgetResolution =
  | { kind: 'exact'; memory: Memory; reason: string }
  | { kind: 'ambiguous'; matches: Memory[]; reason: string }
  | { kind: 'category'; category: MemoryCategory; matches: Memory[]; reason: string }
  | { kind: 'all'; matches: Memory[]; reason: string }
  | { kind: 'not_found'; reason: string };

const categoryLabels: [MemoryCategory, RegExp][] = [
  ['preference', /\bpreferences?\b/i],
  ['goal', /\bgoals?\b/i],
  ['personal_rule', /\bpersonal rules?\b/i],
  ['communication_style', /\b(communication|tone|style)\b/i],
  ['routine', /\broutines?\b/i],
  ['project', /\bprojects?\b/i],
  ['trading_profile', /\btrading profile\b/i],
  ['risk_rule', /\brisk rules?\b/i],
  ['emotional_trigger', /\b(emotional triggers?|triggers?)\b/i],
  ['important_context', /\bimportant context\b/i],
  ['temporary_context', /\btemporary context\b/i],
];

export function resolveForgetRequest(input: {
  query: string;
  memories: Memory[];
}): ForgetResolution {
  const active = input.memories.filter((memory) => memory.status === 'confirmed');
  const normalizedQuery = normalize(input.query);
  if (!normalizedQuery) {
    return { kind: 'not_found', reason: 'The forget request did not include a memory target.' };
  }
  if (/\b(all|everything|every memory|all memories)\b/i.test(input.query)) {
    return {
      kind: 'all',
      matches: active,
      reason: 'The request targets all confirmed memories and requires explicit confirmation.',
    };
  }

  const category = categoryForQuery(input.query);
  if (category) {
    const matches = active.filter((memory) => memory.category === category);
    return matches.length > 0
      ? {
          kind: 'category',
          category,
          matches,
          reason: `The request targets the ${category.replaceAll('_', ' ')} category.`,
        }
      : { kind: 'not_found', reason: 'No confirmed memories exist in that category.' };
  }

  const ranked = active
    .map((memory) => ({ memory, score: scoreMatch(normalizedQuery, normalize(memory.content)) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) => right.score - left.score || left.memory.id.localeCompare(right.memory.id),
    );

  const best = ranked[0];
  if (!best) {
    return { kind: 'not_found', reason: 'No confirmed memory matched the forget request.' };
  }
  const closeMatches = ranked.filter((item) => item.score >= Math.max(0.35, best.score - 0.12));
  if (best.score >= 0.82 && closeMatches.length === 1) {
    return {
      kind: 'exact',
      memory: best.memory,
      reason: 'One confirmed memory clearly matched the forget request.',
    };
  }
  return {
    kind: 'ambiguous',
    matches: closeMatches.slice(0, 5).map((item) => item.memory),
    reason: 'Multiple memories could match, so the user should choose before anything is deleted.',
  };
}

function categoryForQuery(query: string): MemoryCategory | null {
  for (const [category, pattern] of categoryLabels) {
    if (pattern.test(query)) {
      return category;
    }
  }
  return null;
}

function scoreMatch(query: string, memory: string): number {
  if (memory === query || memory.includes(query)) {
    return 1;
  }
  const queryTokens = tokenSet(query);
  const memoryTokens = tokenSet(memory);
  if (queryTokens.size === 0 || memoryTokens.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of queryTokens) {
    if (memoryTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / queryTokens.size;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s.%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

const stopWords = new Set(['the', 'and', 'that', 'this', 'with', 'about', 'memory', 'memories']);
