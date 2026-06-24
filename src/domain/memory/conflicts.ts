import type { Memory, MemoryCategory, MemoryDraft } from './types';

export type MemoryRelationship = 'duplicate' | 'update' | 'conflict' | 'unrelated';

export interface MemoryConflictResult {
  relationship: MemoryRelationship;
  existingMemory?: Memory;
  confidence: number;
  reason: string;
  recommendedAction: 'ignore_duplicate' | 'supersede_existing' | 'ask_user' | 'create_new';
}

const categoryUpdatePairs = new Set<string>([
  'preference:preference',
  'risk_rule:risk_rule',
  'personal_rule:personal_rule',
  'communication_style:communication_style',
  'routine:routine',
  'project:project',
  'trading_profile:trading_profile',
]);

const negationPatterns = [
  /\b(no longer|not anymore|stop|stopped|avoid|never|don't|dont|do not)\b/i,
  /\b(instead|changed|switch(?:ed)? to|prefer(?:s)? now)\b/i,
];

export function classifyMemoryConflict(input: {
  candidate: Pick<MemoryDraft, 'category' | 'content'>;
  existing: Memory[];
}): MemoryConflictResult {
  const candidateTokens = tokenSet(input.candidate.content);
  const normalizedCandidate = normalize(input.candidate.content);

  let best: { memory: Memory; overlap: number; exact: boolean } | null = null;
  for (const memory of input.existing.filter((item) => item.status === 'confirmed')) {
    const overlap = jaccard(candidateTokens, tokenSet(memory.content));
    const exact = normalize(memory.content) === normalizedCandidate;
    if (!best || Number(exact) > Number(best.exact) || overlap > best.overlap) {
      best = { memory, overlap, exact };
    }
  }

  if (!best) {
    return {
      relationship: 'unrelated',
      confidence: 0,
      reason: 'No confirmed memories are close enough to compare.',
      recommendedAction: 'create_new',
    };
  }

  if (best.exact || best.overlap >= 0.92) {
    return {
      relationship: 'duplicate',
      existingMemory: best.memory,
      confidence: best.exact ? 1 : best.overlap,
      reason: 'The candidate says the same thing as an existing confirmed memory.',
      recommendedAction: 'ignore_duplicate',
    };
  }

  const sameCategory = isUpdateCategory(input.candidate.category, best.memory.category);
  const reversal =
    hasReversalLanguage(input.candidate.content) || hasReversalLanguage(best.memory.content);
  if (sameCategory && best.overlap >= 0.36 && reversal) {
    return {
      relationship: 'conflict',
      existingMemory: best.memory,
      confidence: best.overlap,
      reason: 'The candidate appears to reverse or contradict a related memory.',
      recommendedAction: 'ask_user',
    };
  }

  if (sameCategory && best.overlap >= 0.42) {
    return {
      relationship: 'update',
      existingMemory: best.memory,
      confidence: best.overlap,
      reason: 'The candidate appears to update an existing memory in the same category.',
      recommendedAction: 'supersede_existing',
    };
  }

  return {
    relationship: 'unrelated',
    confidence: best.overlap,
    reason: 'No related memory was close enough to update or conflict.',
    recommendedAction: 'create_new',
  };
}

function isUpdateCategory(candidate: MemoryCategory, existing: MemoryCategory): boolean {
  return categoryUpdatePairs.has(`${candidate}:${existing}`);
}

function hasReversalLanguage(value: string): boolean {
  return negationPatterns.some((pattern) => pattern.test(value));
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

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}

const stopWords = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'user',
  'buddy',
  'prefers',
  'prefer',
  'memory',
]);
