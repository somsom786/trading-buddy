import { describe, expect, it } from 'vitest';
import { resolveForgetRequest } from './forgetting';
import type { Memory } from './types';

describe('resolveForgetRequest', () => {
  it('resolves a clear exact forget request', () => {
    const result = resolveForgetRequest({
      query: 'risk at 1% per trade',
      memories: [memory('a', 'User caps risk at 1% per trade.', 'risk_rule')],
    });
    expect(result.kind).toBe('exact');
    if (result.kind === 'exact') {
      expect(result.memory.id).toBe('a');
    }
  });

  it('requires clarification for ambiguous forget requests', () => {
    const result = resolveForgetRequest({
      query: 'New York session',
      memories: [
        memory('a', 'User trades New York session breakouts.', 'routine'),
        memory('b', 'User avoids revenge trades during New York session.', 'personal_rule'),
      ],
    });
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.matches).toHaveLength(2);
    }
  });

  it('recognizes category-level requests without deleting automatically', () => {
    const result = resolveForgetRequest({
      query: 'forget my risk rules',
      memories: [
        memory('a', 'User caps risk at 1%.', 'risk_rule'),
        memory('b', 'User likes concise replies.', 'communication_style'),
      ],
    });
    expect(result.kind).toBe('category');
    if (result.kind === 'category') {
      expect(result.category).toBe('risk_rule');
      expect(result.matches.map((item) => item.id)).toEqual(['a']);
    }
  });
});

function memory(id: string, content: string, category: Memory['category']): Memory {
  return {
    id,
    category,
    content,
    normalizedContent: content.toLocaleLowerCase(),
    status: 'confirmed',
    sourceKind: 'user_explicit',
    confidence: 0.9,
    importance: 0.6,
    sensitivity: 'ordinary',
    createdAt: '2026-06-24T00:00:00.000Z',
    updatedAt: '2026-06-24T00:00:00.000Z',
    useCount: 0,
  };
}
