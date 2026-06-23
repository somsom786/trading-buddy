import type { ConversationSummary, ExportResult, StorageDiagnostics } from './types';

export function readableConversationTime(
  conversation: Pick<ConversationSummary, 'lastMessageAt' | 'updatedAt'>,
  now = new Date(),
): string {
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) {
    return 'Just now';
  }
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${String(diffMinutes)}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${String(diffHours)}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${String(diffDays)}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function summarizeDatabaseLocation(
  diagnostics: Pick<StorageDiagnostics, 'databaseFileName' | 'databaseLocationSummary'> | null,
): string {
  if (!diagnostics) {
    return 'Unavailable';
  }
  return diagnostics.databaseLocationSummary ?? diagnostics.databaseFileName;
}

export function summarizeExportDestination(result: Pick<ExportResult, 'fileName'> | null): string {
  if (!result) {
    return 'No export yet';
  }
  return result.fileName;
}
