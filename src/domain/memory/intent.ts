export type MemoryIntent =
  | { type: 'remember_explicit'; content: string }
  | { type: 'forget_explicit'; query: string }
  | { type: 'list_memories'; query?: string | undefined }
  | { type: 'disable_memory_for_message' }
  | { type: 'disable_memory_for_conversation' }
  | { type: 'none' };

const rememberPatterns = [
  /^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i,
  /^save\s+this\s+memory\s*[:-]?\s+(.+)$/i,
  /^make\s+a\s+note\s+that\s+(.+)$/i,
];

const forgetPatterns = [
  /^(?:please\s+)?forget(?:\s+that)?\s+(.+)$/i,
  /^delete\s+(?:the\s+)?memory\s+about\s+(.+)$/i,
];

export function detectMemoryIntent(message: string): MemoryIntent {
  const trimmed = message.trim();
  if (!trimmed) {
    return { type: 'none' };
  }
  const lower = trimmed.toLocaleLowerCase();
  if (
    /\b(do not|don't|dont)\s+remember\s+this\s+conversation\b/i.test(trimmed) ||
    /\bturn\s+off\s+memory\s+for\s+this\s+conversation\b/i.test(trimmed)
  ) {
    return { type: 'disable_memory_for_conversation' };
  }
  if (
    /\b(do not|don't|dont)\s+remember\s+this\b/i.test(trimmed) ||
    /\bno\s+memory\s+for\s+this\s+message\b/i.test(trimmed)
  ) {
    return { type: 'disable_memory_for_message' };
  }
  if (
    lower === 'what do you remember about me?' ||
    lower === 'what do you remember?' ||
    lower.startsWith('what do you remember about ') ||
    lower.startsWith('show memories') ||
    lower.startsWith('list memories')
  ) {
    return {
      type: 'list_memories',
      query: lower.startsWith('what do you remember about ')
        ? trimmed.slice('what do you remember about '.length).replace(/\?$/, '')
        : undefined,
    };
  }
  for (const pattern of rememberPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) {
      return { type: 'remember_explicit', content: match[1].trim() };
    }
  }
  for (const pattern of forgetPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) {
      return { type: 'forget_explicit', query: match[1].trim() };
    }
  }
  return { type: 'none' };
}
