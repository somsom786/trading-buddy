import type { ChatMessage } from '../local-ai/types';
import type { AgentSessionMessage } from './types';

export const MAX_HIDDEN_COMPANION_CONTEXT_LENGTH = 12_000;

export function agentMessageToChatMessage(message: AgentSessionMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    status:
      message.status === 'superseded'
        ? 'interrupted'
        : message.status === 'pending'
          ? 'streaming'
          : message.status,
    ...(message.status === 'superseded'
      ? { statusNote: 'A newer response attempt replaced this one.' }
      : {}),
  };
}

export function buildHiddenCompanionContext(
  sections: readonly (string | null | undefined)[],
): string {
  const combined = sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n');
  return truncateUtf8(combined, MAX_HIDDEN_COMPANION_CONTEXT_LENGTH);
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (new TextEncoder().encode(value).byteLength <= maximumBytes) {
    return value;
  }
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (new TextEncoder().encode(value.slice(0, middle)).byteLength <= maximumBytes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  let end = low;
  while (end > 0 && isLowSurrogate(value.charCodeAt(end))) {
    end -= 1;
  }
  return value.slice(0, end);
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
