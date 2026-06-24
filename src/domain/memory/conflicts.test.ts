import { describe, expect, it } from 'vitest';
import { classifyMemoryConflict } from './conflicts';
import type { Memory, MemoryDraft } from './types';

describe('classifyMemoryConflict', () => {
  it('detects duplicate memories', () => {
    const existing = [
      memory({ content: 'User caps risk at 1% per trade.', category: 'risk_rule' }),
    ];
    const result = classifyMemoryConflict({
      candidate: draft({ content: 'User caps risk at 1% per trade.', category: 'risk_rule' }),
      existing,
    });
    expect(result.relationship).toBe('duplicate');
    expect(result.recommendedAction).toBe('ignore_duplicate');
  });

  it('detects updates in matching categories', () => {
    const existing = [
      memory({ content: 'User caps risk at 1% per trade on futures.', category: 'risk_rule' }),
    ];
    const result = classifyMemoryConflict({
      candidate: draft({
        content: 'User caps risk at 0.5% per trade on futures.',
        category: 'risk_rule',
      }),
      existing,
    });
    expect(result.relationship).toBe('update');
    expect(result.recommendedAction).toBe('supersede_existing');
  });

  it('asks the user when a related memory appears contradictory', () => {
    const existing = [
      memory({
        content: 'User prefers scalping during the New York session.',
        category: 'preference',
      }),
    ];
    const result = classifyMemoryConflict({
      candidate: draft({
        content: 'User no longer prefers scalping during the New York session.',
        category: 'preference',
      }),
      existing,
    });
    expect(result.relationship).toBe('conflict');
    expect(result.recommendedAction).toBe('ask_user');
  });
});

function memory(overrides: Partial<Memory>): Memory {
  return {
    id: 'memory-1',
    category: 'preference',
    content: 'User prefers concise replies.',
    normalizedContent: 'user prefers concise replies',
    status: 'confirmed',
    sourceKind: 'user_explicit',
    confidence: 0.9,
    importance: 0.6,
    sensitivity: 'ordinary',
    createdAt: '2026-06-24T00:00:00.000Z',
    updatedAt: '2026-06-24T00:00:00.000Z',
    useCount: 0,
    ...overrides,
  };
}

function draft(overrides: Partial<MemoryDraft>): Pick<MemoryDraft, 'category' | 'content'> {
  return {
    category: 'preference',
    content: 'User prefers concise replies.',
    ...overrides,
  };
}
