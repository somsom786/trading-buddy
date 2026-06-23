import type {
  RetentionCleanupResult,
  RetentionPolicy,
  StorageDiagnostics,
  StorageError,
} from '../../domain/storage/types';

interface StorageLabProps {
  diagnostics: StorageDiagnostics | null;
  activeConversationId: string | null;
  activeRequestId: string | null;
  retentionPolicy: RetentionPolicy;
  storageError: StorageError | null;
  onRefresh: () => void;
  onRunRetention: () => Promise<RetentionCleanupResult | null>;
  onSimulateInterrupted: () => Promise<void>;
}

export function StorageLab({
  diagnostics,
  activeConversationId,
  activeRequestId,
  retentionPolicy,
  storageError,
  onRefresh,
  onRunRetention,
  onSimulateInterrupted,
}: StorageLabProps) {
  return (
    <details className="storage-lab">
      <summary>Storage Lab · development only</summary>
      <div className="storage-lab__content">
        <div className="button-row">
          <button type="button" onClick={onRefresh}>
            Refresh diagnostics
          </button>
          <button
            type="button"
            onClick={() => {
              void onRunRetention();
            }}
          >
            Run retention cleanup
          </button>
          <button
            type="button"
            onClick={() => {
              void onSimulateInterrupted();
            }}
          >
            Simulate interrupted message
          </button>
        </div>

        <dl>
          <dt>Storage</dt>
          <dd>{diagnostics?.available ? 'available' : 'unavailable'}</dd>
          <dt>Database</dt>
          <dd>{diagnostics?.databaseFileName ?? 'unknown'}</dd>
          <dt>Schema</dt>
          <dd>{diagnostics?.schemaVersion ?? 'unknown'}</dd>
          <dt>Conversations</dt>
          <dd>{diagnostics?.conversationCount ?? 0}</dd>
          <dt>Active / archived</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.activeConversationCount)} / ${String(
                  diagnostics.archivedConversationCount,
                )}`
              : '0 / 0'}
          </dd>
          <dt>Messages</dt>
          <dd>{diagnostics?.messageCount ?? 0}</dd>
          <dt>Retention</dt>
          <dd>{retentionPolicy}</dd>
          <dt>Last cleanup</dt>
          <dd>{diagnostics?.lastSuccessfulRetentionCleanupAt ?? 'not recorded'}</dd>
          <dt>Active conversation</dt>
          <dd>{activeConversationId ?? 'none'}</dd>
          <dt>Active request</dt>
          <dd>{activeRequestId ?? 'none'}</dd>
          <dt>Storage error</dt>
          <dd>{storageError?.code ?? 'none'}</dd>
        </dl>
        <p className="muted">
          Storage Lab never exposes raw SQL and does not display conversation contents.
        </p>
      </div>
    </details>
  );
}
