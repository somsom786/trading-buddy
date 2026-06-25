import { describe, expect, it } from 'vitest';
import { detectJournalIntent } from './intent';

describe('journal intent detection', () => {
  it('starts general, daily, and trading session journals deterministically', () => {
    expect(detectJournalIntent("let's journal")).toEqual({
      type: 'start_journal',
      mode: 'guided',
      kind: 'free_reflection',
    });
    expect(detectJournalIntent('daily check-in')).toEqual({
      type: 'start_journal',
      mode: 'quick_check_in',
      kind: 'daily_check_in',
    });
    expect(detectJournalIntent('review my trading')).toEqual({
      type: 'start_journal',
      mode: 'guided',
      kind: 'trading_session',
    });
  });

  it('keeps unrelated chat outside journal routing', () => {
    expect(detectJournalIntent('what model are you using?')).toEqual({ type: 'none' });
  });

  it('detects explicit save and discard controls', () => {
    expect(detectJournalIntent('save this as journal entry')).toEqual({
      type: 'save_current_as_journal',
    });
    expect(detectJournalIntent('discard this journal')).toEqual({ type: 'discard_journal' });
  });
});
