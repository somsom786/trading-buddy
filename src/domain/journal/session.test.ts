import { describe, expect, it } from 'vitest';
import {
  createIdleJournalSession,
  journalSessionReducer,
  journalSessionToDraft,
  sessionHasMeaningfulContent,
} from './session';

describe('journal session reducer', () => {
  it('creates a private guided trading session draft explicitly', () => {
    let session = createIdleJournalSession();
    session = journalSessionReducer(session, {
      type: 'start',
      id: 'journal-session-1',
      mode: 'guided',
      kind: 'trading_session',
      now: '2026-06-25T10:00:00.000Z',
      isPrivate: true,
    });
    session = journalSessionReducer(session, {
      type: 'set_body',
      body: 'I stopped after two trades and wrote down my risk before entering.',
    });
    session = journalSessionReducer(session, {
      type: 'set_ratings',
      mood: 3,
      energy: 4,
      stress: 2,
      confidence: 3,
    });

    expect(sessionHasMeaningfulContent(session)).toBe(true);
    expect(journalSessionToDraft(session)).toMatchObject({
      kind: 'trading_session',
      status: 'completed',
      sourceKind: 'desktop_guided',
      occurredAt: '2026-06-25T10:00:00.000Z',
      mood: 3,
      energy: 4,
      stress: 2,
      confidence: 3,
      isPrivate: true,
      allowMemoryCandidates: false,
    });
  });

  it('prevents a second active journal from replacing an unsaved session', () => {
    const active = journalSessionReducer(createIdleJournalSession(), {
      type: 'start',
      id: 'journal-session-1',
      mode: 'guided',
      kind: 'free_reflection',
      now: '2026-06-25T10:00:00.000Z',
      isPrivate: true,
    });
    const blocked = journalSessionReducer(active, {
      type: 'start',
      id: 'journal-session-2',
      mode: 'free_write',
      kind: 'idea',
      now: '2026-06-25T10:01:00.000Z',
      isPrivate: true,
    });

    expect(blocked.id).toBe('journal-session-1');
    expect(blocked.lastError).toBe('A journal session is already active.');
  });
});
