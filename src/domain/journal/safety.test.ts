import { describe, expect, it } from 'vitest';
import { assessJournalSafety } from './safety';

describe('journal safety assessment', () => {
  it('keeps normal private journal text eligible for explicit memory opt-in', () => {
    expect(assessJournalSafety('I felt impatient but took a walk.')).toEqual({
      level: 'normal',
      message: null,
      blockMemorySuggestion: false,
    });
  });

  it('blocks memory suggestion for crisis-shaped journal text', () => {
    const result = assessJournalSafety('I might hurt myself tonight.');
    expect(result.level).toBe('serious');
    expect(result.blockMemorySuggestion).toBe(true);
    expect(result.message).toContain('immediate danger');
  });
});
