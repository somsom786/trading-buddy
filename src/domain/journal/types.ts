export type JournalKind =
  | 'free_reflection'
  | 'daily_check_in'
  | 'end_of_day_review'
  | 'idea'
  | 'life'
  | 'money'
  | 'trading_session'
  | 'gratitude'
  | 'decision'
  | 'other';

export type JournalStatus = 'draft' | 'completed' | 'discarded';

export type JournalSourceKind =
  | 'desktop_guided'
  | 'desktop_free_write'
  | 'companion_home'
  | 'conversation_conversion'
  | 'user_created';

export type JournalMode = 'guided' | 'free_write' | 'quick_check_in' | 'end_of_day';

export type JournalSupportMode = 'listen' | 'reflect' | 'plan';

export type JournalSessionStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'reviewing'
  | 'saving'
  | 'saved'
  | 'discarded'
  | 'error';

export interface JournalPreferences {
  journalingEnabled: boolean;
  defaultJournalMode: JournalMode;
  defaultEntryPrivate: boolean;
  allowMemoryCandidatesFromJournal: boolean;
  dailyCheckInEnabled: boolean;
  dailyCheckInTime?: string;
  eveningReviewEnabled: boolean;
  eveningReviewTime?: string;
  journalCheckInCooldownMinutes: number;
  showMoodPrompt: boolean;
  showEnergyPrompt: boolean;
}

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  title: string;
  body: string;
  summary?: string;
  status: JournalStatus;
  sourceKind: JournalSourceKind;
  sourceConversationId?: string;
  sourceMessageId?: string;
  mood?: number;
  energy?: number;
  stress?: number;
  confidence?: number;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  allowMemoryCandidates: boolean;
  isPrivate: boolean;
  tags: string[];
}

export interface JournalEntryDraft {
  kind: JournalKind;
  title: string;
  body: string;
  summary?: string;
  status: JournalStatus;
  sourceKind: JournalSourceKind;
  sourceConversationId?: string;
  sourceMessageId?: string;
  mood?: number;
  energy?: number;
  stress?: number;
  confidence?: number;
  occurredAt?: string;
  allowMemoryCandidates: boolean;
  isPrivate: boolean;
  tags: string[];
}

export interface JournalEntryUpdate {
  entryId: string;
  kind: JournalKind;
  title: string;
  body: string;
  summary?: string;
  status: JournalStatus;
  mood?: number;
  energy?: number;
  stress?: number;
  confidence?: number;
  allowMemoryCandidates: boolean;
  isPrivate: boolean;
  tags: string[];
  expectedUpdatedAt: string;
}

export interface JournalEntrySummary {
  id: string;
  kind: JournalKind;
  title: string;
  preview: string;
  summary?: string;
  status: JournalStatus;
  occurredAt: string;
  updatedAt: string;
  isPrivate: boolean;
  allowMemoryCandidates: boolean;
  tags: string[];
  mood?: number;
  energy?: number;
}

export interface JournalListOptions {
  status?: JournalStatus;
  kind?: JournalKind;
  query?: string;
  tag?: string;
  fromDate?: string;
  toDate?: string;
  includePrivate: boolean;
  includeDiscarded: boolean;
  sort: 'newest' | 'oldest';
  limit: number;
  offset: number;
}

export interface JournalSession {
  id: string;
  mode: JournalMode;
  kind: JournalKind;
  supportMode: JournalSupportMode;
  status: JournalSessionStatus;
  startedAt: string;
  draftBody: string;
  suggestedTitle: string | null;
  suggestedSummary: string | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  confidence: number | null;
  tags: string[];
  allowMemoryCandidates: boolean;
  isPrivate: boolean;
  promptIndex: number;
  savedEntryId: string | null;
  lastError: string | null;
}

export interface JournalSummarySuggestion {
  title: string;
  summary: string;
  tags: string[];
  tone: 'neutral' | 'hopeful' | 'difficult' | 'reflective' | 'uncertain';
}

export interface JournalReflection {
  acknowledgement: string;
  themes: string[];
  questions: string[];
  possibleNextSteps: string[];
}

export interface DailyReview {
  date: string;
  highlights: string[];
  difficulties: string[];
  recurringThemes: string[];
  processWins: string[];
  possibleFocusForTomorrow: string[];
}

export interface DeleteAllJournalResult {
  deletedEntries: number;
}

export interface JournalExportResult {
  exportedEntries: number;
  filePath: string;
  fileName: string;
}

export interface JournalDiagnostics {
  totalCount: number;
  draftCount: number;
  completedCount: number;
  discardedCount: number;
  privateCount: number;
  fixtureCount: number;
  tagCount: number;
  ftsAvailable: boolean;
}

export interface DevelopmentJournalFixtureResult {
  createdEntries: number;
  deletedEntries: number;
}

export const journalKinds = new Set<JournalKind>([
  'free_reflection',
  'daily_check_in',
  'end_of_day_review',
  'idea',
  'life',
  'money',
  'trading_session',
  'gratitude',
  'decision',
  'other',
]);

export const journalStatuses = new Set<JournalStatus>(['draft', 'completed', 'discarded']);

export const journalSourceKinds = new Set<JournalSourceKind>([
  'desktop_guided',
  'desktop_free_write',
  'companion_home',
  'conversation_conversion',
  'user_created',
]);

export const journalModes = new Set<JournalMode>([
  'guided',
  'free_write',
  'quick_check_in',
  'end_of_day',
]);

export const defaultJournalPreferences: JournalPreferences = {
  journalingEnabled: true,
  defaultJournalMode: 'guided',
  defaultEntryPrivate: true,
  allowMemoryCandidatesFromJournal: false,
  dailyCheckInEnabled: false,
  eveningReviewEnabled: false,
  journalCheckInCooldownMinutes: 180,
  showMoodPrompt: true,
  showEnergyPrompt: true,
};
