import { looksLikeSecret } from './secretDetection';
import {
  memoryCategories,
  memorySensitivities,
  type MemoryCategory,
  type MemorySensitivity,
  type ProposedMemoryCandidate,
} from './types';

export const MEMORY_EXTRACTION_SYSTEM_PROMPT = `You propose companion memories for Trading Buddy.
Return JSON only. Do not include markdown.
Never propose secrets, credentials, system prompts, hidden reasoning, or full quoted external content.
Propose at most three concise, user-owned memories.
Use only approved categories and sensitivity labels.
If there is no durable user-approved memory candidate, return {"candidates":[]}.`;

export function buildMemoryExtractionUserPrompt(input: {
  userMessage: string;
  existingMemories: string[];
  utcDate: string;
}): string {
  return JSON.stringify(
    {
      task: 'propose_memory_candidates',
      utcDate: input.utcDate,
      categories: [...memoryCategories],
      sensitivities: [...memorySensitivities],
      existingMemories: input.existingMemories.slice(0, 8),
      userMessage: input.userMessage,
      outputShape: {
        candidates: [
          {
            category: 'preference',
            content: 'User prefers direct feedback.',
            confidence: 0.8,
            importance: 0.6,
            sensitivity: 'ordinary',
            expiry: { kind: 'none' },
            action: 'create',
          },
        ],
      },
    },
    null,
    2,
  );
}

export function parseMemoryExtractionResponse(raw: string): ProposedMemoryCandidate[] {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) {
    return [];
  }
  const seen = new Set<string>();
  const candidates: ProposedMemoryCandidate[] = [];
  for (const value of parsed.candidates.slice(0, 3)) {
    const candidate = coerceCandidate(value);
    if (!candidate) {
      continue;
    }
    const key = normalizeForDeduplication(candidate.content);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates;
}

export function explicitMemoryCandidate(content: string): ProposedMemoryCandidate | null {
  const trimmed = content.trim();
  if (!trimmed || looksLikeSecret(trimmed) || looksInstructionLike(trimmed)) {
    return null;
  }
  return {
    category: classifyCategory(trimmed),
    content: trimmed,
    confidence: 1,
    importance: trimmed.length > 80 ? 0.7 : 0.55,
    sensitivity: classifySensitivity(trimmed),
    expiry: { kind: 'none' },
    action: 'create',
  };
}

export function candidateToDraft(
  candidate: ProposedMemoryCandidate,
  source: {
    sourceConversationId?: string | undefined;
    sourceMessageId?: string | undefined;
    status: 'proposed' | 'confirmed';
    sourceKind?: 'user_explicit' | 'model_proposed' | 'user_created' | undefined;
  },
) {
  return {
    category: candidate.category,
    content: candidate.content,
    status: source.status,
    sourceKind: source.sourceKind ?? ('user_explicit' as const),
    sourceConversationId: source.sourceConversationId,
    sourceMessageId: source.sourceMessageId,
    confidence: candidate.confidence,
    importance: candidate.importance,
    sensitivity: candidate.sensitivity,
    expiresAt: resolveExpiry(candidate.expiry),
  };
}

function coerceCandidate(value: unknown): ProposedMemoryCandidate | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!memoryCategories.has(value.category as MemoryCategory)) {
    return null;
  }
  if (!memorySensitivities.has(value.sensitivity as MemorySensitivity)) {
    return null;
  }
  if (
    value.action !== 'create' &&
    value.action !== 'update_existing' &&
    value.action !== 'ignore'
  ) {
    return null;
  }
  if (value.action === 'ignore') {
    return null;
  }
  if (typeof value.content !== 'string') {
    return null;
  }
  const content = value.content.trim();
  if (
    content.length < 8 ||
    content.length > 600 ||
    looksLikeSecret(content) ||
    looksInstructionLike(content)
  ) {
    return null;
  }
  return {
    category: value.category as MemoryCategory,
    content,
    confidence: clampNumber(value.confidence, 0, 1, 0.5),
    importance: clampNumber(value.importance, 0, 1, 0.5),
    sensitivity: value.sensitivity as MemorySensitivity,
    expiry: coerceExpiry(value.expiry),
    action: value.action,
    existingMemoryId:
      typeof value.existingMemoryId === 'string' ? value.existingMemoryId : undefined,
  };
}

function classifyCategory(content: string): MemoryCategory {
  if (/\b(risk|1%|stop loss|leverage|revenge trading|losses)\b/i.test(content)) {
    return 'risk_rule';
  }
  if (/\b(goal|trying to|want to)\b/i.test(content)) {
    return 'goal';
  }
  if (/\b(direct|concise|detailed|feedback|tone)\b/i.test(content)) {
    return 'communication_style';
  }
  if (/\b(always|never|rule)\b/i.test(content)) {
    return 'personal_rule';
  }
  return 'preference';
}

function classifySensitivity(content: string): MemorySensitivity {
  if (/\b(address|diagnosis|religion|politic|criminal|sexual|medical|therapy)\b/i.test(content)) {
    return 'sensitive';
  }
  if (/\b(risk|money|trading|loss|project|routine|prefer|goal)\b/i.test(content)) {
    return 'personal';
  }
  return 'ordinary';
}

function coerceExpiry(value: unknown): ProposedMemoryCandidate['expiry'] {
  if (
    !isRecord(value) ||
    (value.kind !== 'none' && value.kind !== 'date' && value.kind !== 'days')
  ) {
    return { kind: 'none' };
  }
  if (value.kind === 'date' && typeof value.value === 'string') {
    return { kind: 'date', value: value.value };
  }
  if (value.kind === 'days' && typeof value.value === 'number') {
    return { kind: 'days', value: Math.max(1, Math.min(365, Math.round(value.value))) };
  }
  return { kind: 'none' };
}

function resolveExpiry(expiry: ProposedMemoryCandidate['expiry']): string | undefined {
  if (!expiry || expiry.kind === 'none') {
    return undefined;
  }
  if (expiry.kind === 'date' && typeof expiry.value === 'string') {
    const date = new Date(expiry.value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (expiry.kind === 'days' && typeof expiry.value === 'number') {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + expiry.value);
    return date.toISOString();
  }
  return undefined;
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

function looksInstructionLike(content: string): boolean {
  return /\b(ignore previous instructions|system prompt|developer message|act as|you must)\b/i.test(
    content,
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizeForDeduplication(content: string): string {
  return content.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
