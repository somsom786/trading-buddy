import type {
  JournalEntryDraft,
  JournalKind,
  JournalMode,
  JournalSession,
  JournalSupportMode,
} from './types';

export type JournalSessionEvent =
  | {
      type: 'start';
      id: string;
      mode: JournalMode;
      kind: JournalKind;
      supportMode?: JournalSupportMode;
      now: string;
      isPrivate: boolean;
    }
  | { type: 'append'; text: string }
  | { type: 'set_body'; body: string }
  | { type: 'next_prompt' }
  | { type: 'review' }
  | { type: 'saving' }
  | { type: 'saved'; entryId: string }
  | { type: 'discard' }
  | { type: 'error'; message: string }
  | {
      type: 'set_ratings';
      mood?: number | null;
      energy?: number | null;
      stress?: number | null;
      confidence?: number | null;
    }
  | { type: 'set_suggestions'; title?: string | null; summary?: string | null; tags?: string[] }
  | { type: 'set_mode'; mode: JournalMode }
  | { type: 'set_support_mode'; supportMode: JournalSupportMode }
  | { type: 'set_memory_opt_in'; allow: boolean };

export function createIdleJournalSession(): JournalSession {
  return {
    id: '',
    mode: 'guided',
    kind: 'free_reflection',
    supportMode: 'listen',
    status: 'idle',
    startedAt: '',
    draftBody: '',
    suggestedTitle: null,
    suggestedSummary: null,
    mood: null,
    energy: null,
    stress: null,
    confidence: null,
    tags: [],
    allowMemoryCandidates: false,
    isPrivate: true,
    promptIndex: 0,
    savedEntryId: null,
    lastError: null,
  };
}

export function journalSessionReducer(
  session: JournalSession,
  event: JournalSessionEvent,
): JournalSession {
  switch (event.type) {
    case 'start':
      if (
        session.status !== 'idle' &&
        session.status !== 'saved' &&
        session.status !== 'discarded'
      ) {
        return { ...session, lastError: 'A journal session is already active.' };
      }
      return {
        ...createIdleJournalSession(),
        id: event.id,
        mode: event.mode,
        kind: event.kind,
        supportMode: event.supportMode ?? 'listen',
        status: 'active',
        startedAt: event.now,
        isPrivate: event.isPrivate,
      };
    case 'append':
      if (session.status !== 'active' && session.status !== 'reviewing') {
        return session;
      }
      return {
        ...session,
        draftBody: [session.draftBody, event.text.trim()].filter(Boolean).join('\n\n'),
        status: 'active',
      };
    case 'set_body':
      if (session.status !== 'active' && session.status !== 'reviewing') {
        return session;
      }
      return { ...session, draftBody: event.body };
    case 'next_prompt':
      return { ...session, promptIndex: session.promptIndex + 1 };
    case 'review':
      return { ...session, status: 'reviewing' };
    case 'saving':
      if (session.status === 'saved' || session.status === 'saving') {
        return { ...session, lastError: 'This journal entry is already being saved.' };
      }
      return { ...session, status: 'saving', lastError: null };
    case 'saved':
      return { ...session, status: 'saved', savedEntryId: event.entryId };
    case 'discard':
      return { ...session, status: 'discarded', draftBody: '', lastError: null };
    case 'error':
      return { ...session, status: 'error', lastError: event.message };
    case 'set_ratings':
      return {
        ...session,
        mood: normalizeRating(event.mood, session.mood),
        energy: normalizeRating(event.energy, session.energy),
        stress: normalizeRating(event.stress, session.stress),
        confidence: normalizeRating(event.confidence, session.confidence),
      };
    case 'set_suggestions':
      return {
        ...session,
        suggestedTitle: event.title === undefined ? session.suggestedTitle : event.title,
        suggestedSummary: event.summary === undefined ? session.suggestedSummary : event.summary,
        tags: event.tags ?? session.tags,
      };
    case 'set_mode':
      return { ...session, mode: event.mode };
    case 'set_support_mode':
      return { ...session, supportMode: event.supportMode };
    case 'set_memory_opt_in':
      return { ...session, allowMemoryCandidates: event.allow };
  }
}

export function sessionHasMeaningfulContent(session: JournalSession): boolean {
  return session.draftBody.trim().length >= 3 || session.tags.length > 0;
}

export function journalSessionToDraft(session: JournalSession): JournalEntryDraft {
  const suggestedTitle = session.suggestedTitle?.trim();
  const draft: JournalEntryDraft = {
    kind: session.kind,
    title:
      suggestedTitle !== undefined && suggestedTitle.length > 0
        ? suggestedTitle
        : fallbackJournalTitle(session),
    body: session.draftBody,
    status: 'completed',
    sourceKind: session.mode === 'free_write' ? 'desktop_free_write' : 'desktop_guided',
    occurredAt: session.startedAt,
    allowMemoryCandidates: session.allowMemoryCandidates,
    isPrivate: session.isPrivate,
    tags: session.tags,
  };
  const summary = session.suggestedSummary?.trim();
  if (summary) {
    draft.summary = summary;
  }
  if (session.mood !== null) {
    draft.mood = session.mood;
  }
  if (session.energy !== null) {
    draft.energy = session.energy;
  }
  if (session.stress !== null) {
    draft.stress = session.stress;
  }
  if (session.confidence !== null) {
    draft.confidence = session.confidence;
  }
  return draft;
}

function fallbackJournalTitle(session: JournalSession): string {
  const firstLine = session.draftBody.trim().split(/\r?\n/)[0]?.trim();
  if (firstLine) {
    return firstLine.slice(0, 80);
  }
  return session.kind.replaceAll('_', ' ');
}

function normalizeRating(next: number | null | undefined, current: number | null): number | null {
  if (next === undefined) {
    return current;
  }
  if (next === null) {
    return null;
  }
  return Number.isInteger(next) && next >= 1 && next <= 5 ? next : current;
}
