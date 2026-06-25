import type { JournalKind, JournalMode } from './types';

export type JournalIntent =
  | { type: 'start_journal'; mode: JournalMode; kind: JournalKind }
  | { type: 'save_current_as_journal' }
  | { type: 'discard_journal' }
  | { type: 'continue_journal' }
  | { type: 'none' };

export function detectJournalIntent(message: string): JournalIntent {
  const trimmed = message.trim();
  const lower = trimmed.toLocaleLowerCase();
  if (!lower) {
    return { type: 'none' };
  }
  if (/^(save this as|save current as|save as) (a )?journal entry\.?$/i.test(trimmed)) {
    return { type: 'save_current_as_journal' };
  }
  if (/^(discard|cancel|stop) (this )?journal( session)?\.?$/i.test(trimmed)) {
    return { type: 'discard_journal' };
  }
  if (/^(continue|resume) (my )?journal( draft)?\.?$/i.test(trimmed)) {
    return { type: 'continue_journal' };
  }
  if (
    /^let'?s journal\.?$/i.test(trimmed) ||
    /^start (a )?journal( session)?\.?$/i.test(trimmed) ||
    /^can i talk about my day\??$/i.test(trimmed)
  ) {
    return { type: 'start_journal', mode: 'guided', kind: 'free_reflection' };
  }
  if (/\b(i need to vent|i need to talk|can i vent)\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'guided', kind: 'life' };
  }
  if (/\b(i have an idea|capture an idea|idea capture)\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'guided', kind: 'idea' };
  }
  if (/\b(let'?s review today|review my day|end of day|before the day ends)\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'end_of_day', kind: 'end_of_day_review' };
  }
  if (/\b(daily check.?in|check in with me|how am i doing today)\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'quick_check_in', kind: 'daily_check_in' };
  }
  if (/\b(trading session|how was my trading session|review my trading)\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'guided', kind: 'trading_session' };
  }
  if (/\bfree.?write|free write journal\b/i.test(trimmed)) {
    return { type: 'start_journal', mode: 'free_write', kind: 'free_reflection' };
  }
  return { type: 'none' };
}
