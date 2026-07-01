import type { AgentSessionMessage, AgentSessionSnapshot } from './types';

export interface RetrySource {
  userMessage: AgentSessionMessage;
  previousAssistant: AgentSessionMessage;
  nextAttempt: number;
}

export function latestRetrySource(snapshot: AgentSessionSnapshot): RetrySource | null {
  for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
    const assistant = snapshot.messages[index];
    if (
      assistant?.role !== 'assistant' ||
      !['cancelled', 'failed', 'completed'].includes(assistant.status) ||
      !assistant.sourceUserMessageId
    ) {
      continue;
    }
    const userMessage = snapshot.messages.find(
      (message) => message.role === 'user' && message.id === assistant.sourceUserMessageId,
    );
    if (!userMessage) {
      return null;
    }
    return {
      userMessage,
      previousAssistant: assistant,
      nextAttempt: Math.max(1, assistant.attempt ?? 1) + 1,
    };
  }
  return null;
}
