import { describe, expect, it } from 'vitest';
import { buildContextBudget } from './budget';
import type { ContinuityRetrievalItem } from './types';

const item = (
  sourceId: string,
  content: string,
  reasons: ContinuityRetrievalItem['reasonCodes'],
): ContinuityRetrievalItem => ({
  sourceType: 'episode',
  sourceId,
  title: sourceId,
  content,
  sensitivity: 'ordinary',
  score: 0.7,
  reasonCodes: reasons,
  sourceMessageIds: [],
});

describe('context budget manager', () => {
  it('protects the current turn and prioritizes unresolved corrections deterministically', () => {
    const result = buildContextBudget({
      systemPrompt: 'Safety and identity.',
      continuityItems: [
        item('ordinary', 'A lower priority event.', ['recent_episode']),
        item('correction', 'User corrected launch to September.', ['user_corrected']),
        item('unresolved', 'User acquisition remains unresolved.', ['current_life_context']),
      ],
      recentMessages: Array.from({ length: 30 }, (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `turn ${String(index)} ${'x'.repeat(300)}`,
      })),
      currentUserMessage: 'What was still unresolved?',
      modelContextTokens: 2_048,
      responseReserveTokens: 512,
      recentMessageLimit: 8,
    });
    expect(result.messages.at(-1)).toEqual({
      role: 'user',
      content: 'What was still unresolved?',
    });
    expect(result.messages.map((message) => message.content).join('\n')).toContain(
      'launch to September',
    );
    expect(result.messages.map((message) => message.content).join('\n')).toContain(
      'remains unresolved',
    );
    expect(result.diagnostics.estimatedInputTokens).toBeLessThanOrEqual(
      result.diagnostics.inputBudgetTokens,
    );
    expect(result.diagnostics.droppedOlderMessages).toBeGreaterThan(0);
  });

  it('uses conservative character estimation without a tokenizer', () => {
    const result = buildContextBudget({
      systemPrompt: 'System',
      recentMessages: [],
      currentUserMessage: 'Hello',
    });
    expect(result.diagnostics.reasonCodes).toContain('response_reserve_applied');
    expect(result.diagnostics.estimatedInputTokens).toBeGreaterThan(0);
  });
});
