import { detectMemoryIntent } from './intent';
import { looksLikeSecret } from './secretDetection';
import type { MemoryExtractionDecision, MemoryPreferences } from './types';

interface PrefilterInput {
  role: 'user' | 'assistant';
  content: string;
  temporaryChat: boolean;
  memoryEnabled: boolean;
  conversationOptedOut?: boolean;
  preferences?: Pick<MemoryPreferences, 'memoryApprovalMode'>;
}

export function decideMemoryExtraction(input: PrefilterInput): MemoryExtractionDecision {
  if (input.role !== 'user') {
    return { shouldExtract: false, reason: 'not_memory_worthy' };
  }
  if (input.temporaryChat) {
    return { shouldExtract: false, reason: 'temporary_chat' };
  }
  if (!input.memoryEnabled) {
    return { shouldExtract: false, reason: 'memory_disabled' };
  }
  if (input.conversationOptedOut) {
    return { shouldExtract: false, reason: 'user_opt_out' };
  }
  const content = input.content.trim();
  if (!content) {
    return { shouldExtract: false, reason: 'not_memory_worthy' };
  }
  if (looksLikeSecret(content)) {
    return { shouldExtract: false, reason: 'secret_detected' };
  }
  const intent = detectMemoryIntent(content);
  if (
    intent.type === 'disable_memory_for_message' ||
    intent.type === 'disable_memory_for_conversation'
  ) {
    return { shouldExtract: false, reason: 'user_opt_out' };
  }
  if (intent.type === 'remember_explicit') {
    return { shouldExtract: true, reason: 'explicit_request' };
  }
  if (input.preferences?.memoryApprovalMode === 'manual_only') {
    return { shouldExtract: false, reason: 'not_memory_worthy' };
  }
  if (isAcknowledgement(content) || isGreeting(content) || isQuestionOnly(content)) {
    return { shouldExtract: false, reason: 'not_memory_worthy' };
  }
  if (isHypothetical(content) || looksLikeExternalQuote(content)) {
    return { shouldExtract: false, reason: 'not_memory_worthy' };
  }
  if (
    /\b(my goal is|i want to|i am trying to|i'm trying to|i need to stop|my rule is)\b/i.test(
      content,
    )
  ) {
    return { shouldExtract: true, reason: 'goal_or_rule' };
  }
  if (
    /\b(i prefer|i like|i hate|i usually|i always|i never|my max(?:imum)? risk|risk limit|revenge trading|after two losses|trading style)\b/i.test(
      content,
    )
  ) {
    return { shouldExtract: true, reason: 'durable_statement' };
  }
  if (
    /\b(this week|today until|until next|for the next \d+ days|temporary|currently working on)\b/i.test(
      content,
    )
  ) {
    return { shouldExtract: true, reason: 'temporary_context' };
  }
  return { shouldExtract: false, reason: 'not_memory_worthy' };
}

function isGreeting(content: string): boolean {
  return /^(hi|hello|hey|yo|gm|good morning|good evening)[!. ]*$/i.test(content.trim());
}

function isAcknowledgement(content: string): boolean {
  return /^(ok|okay|yep|yes|no|thanks|thank you|cool|nice|got it)[!. ]*$/i.test(content.trim());
}

function isQuestionOnly(content: string): boolean {
  return (
    content.endsWith('?') &&
    !/\b(i prefer|remember|my goal|my rule|my max|i usually)\b/i.test(content)
  );
}

function isHypothetical(content: string): boolean {
  return /\b(imagine|suppose|hypothetically|example:|for example)\b/i.test(content);
}

function looksLikeExternalQuote(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('>') || /^["“].+["”]$/.test(trimmed);
}
