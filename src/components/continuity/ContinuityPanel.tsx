import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_CONTINUITY_PREFERENCES,
  type ContinuityPreferences,
  type ContinuitySnapshot,
  type EpisodeRecord,
} from '../../domain/continuity/types';
import { normalizeStorageError, type StorageError } from '../../domain/storage/types';
import {
  tauriContinuityService,
  type ContinuityService,
} from '../../services/tauri/continuityService';
import { tauriStorageService, type StorageService } from '../../services/tauri/storageService';

interface ContinuityPanelProps {
  activeConversationId: string | null;
  continuityService?: ContinuityService;
  storageService?: StorageService;
  onNotice: (message: string) => void;
  onError: (error: StorageError) => void;
}

export function ContinuityPanel({
  activeConversationId,
  continuityService = tauriContinuityService,
  storageService = tauriStorageService,
  onNotice,
  onError,
}: ContinuityPanelProps) {
  const [snapshot, setSnapshot] = useState<ContinuitySnapshot | null>(null);
  const [preferences, setPreferences] = useState<ContinuityPreferences>(
    DEFAULT_CONTINUITY_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextSnapshot, settings] = await Promise.all([
        continuityService.snapshot(),
        storageService.getSettings(),
      ]);
      setSnapshot(nextSnapshot);
      setPreferences(settings.continuityPreferences);
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setLoading(false);
    }
  }, [continuityService, onError, storageService]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const updatePreferences = async (patch: Partial<ContinuityPreferences>) => {
    const next = { ...preferences, ...patch };
    try {
      const settings = await storageService.setContinuityPreferences(next);
      setPreferences(settings.continuityPreferences);
      onNotice('Learning preferences saved locally.');
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  };

  const updateEpisode = async (episode: EpisodeRecord, status: EpisodeRecord['status']) => {
    try {
      await continuityService.updateEpisode({
        episodeId: episode.id,
        title: episode.title,
        summary: episode.summary,
        status,
      });
      onNotice(`Episode ${status.replaceAll('_', ' ')}.`);
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  };

  const editEpisode = async (episode: EpisodeRecord) => {
    const title = window.prompt('Episode title', episode.title)?.trim();
    if (!title) {
      return;
    }
    const summary = window.prompt('Correct remembered detail', episode.summary)?.trim();
    if (!summary) {
      return;
    }
    try {
      await continuityService.updateEpisode({
        episodeId: episode.id,
        title,
        summary,
        status: episode.status === 'proposed' ? 'confirmed' : episode.status,
      });
      onNotice('Episode corrected. Its previous embedding is now stale.');
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  };

  const deleteAll = async () => {
    if (
      !window.confirm('Delete all summaries, episodes, entities, current-life items, and vectors?')
    ) {
      return;
    }
    try {
      const deleted = await continuityService.deleteAll();
      onNotice(`Deleted ${String(deleted)} continuity records.`);
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  };

  return (
    <section className="continuity-panel" aria-labelledby="continuity-title">
      <header>
        <p className="eyebrow">Local learning</p>
        <h2 id="continuity-title">Continuity</h2>
        <p>
          Inspect what Buddy learned, where it came from, and whether semantic retrieval is ready.
          Conversation transcripts, journal entries, confirmed facts, and trading data remain
          separate stores.
        </p>
      </header>

      <div className="continuity-controls">
        <PreferenceToggle
          label="Background consolidation"
          checked={preferences.consolidationEnabled}
          onChange={(checked) => void updatePreferences({ consolidationEnabled: checked })}
        />
        <PreferenceToggle
          label="Conversation compaction"
          checked={preferences.conversationCompactionEnabled}
          onChange={(checked) => void updatePreferences({ conversationCompactionEnabled: checked })}
        />
        <PreferenceToggle
          label="Semantic retrieval"
          checked={preferences.semanticMemoryEnabled}
          onChange={(checked) => void updatePreferences({ semanticMemoryEnabled: checked })}
        />
        <PreferenceToggle
          label="Automatic ordinary learning"
          checked={preferences.automaticOrdinaryLearningEnabled}
          onChange={(checked) =>
            void updatePreferences({ automaticOrdinaryLearningEnabled: checked })
          }
        />
      </div>

      <dl className="storage-facts">
        <dt>Semantic memory</dt>
        <dd>{snapshot?.semanticStatus.replaceAll('_', ' ') ?? 'Checking'}</dd>
        <dt>Embedding model</dt>
        <dd>{snapshot?.embeddingModel ?? preferences.embeddingModel}</dd>
        <dt>Vectors</dt>
        <dd>
          {String(snapshot?.embeddingCount ?? 0)} ready ·{' '}
          {String(snapshot?.staleEmbeddingCount ?? 0)} stale
        </dd>
      </dl>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => void refresh()}>
          Refresh learning
        </button>
        <button
          type="button"
          onClick={() => {
            if (!activeConversationId) {
              onNotice('Open a saved conversation before consolidating.');
              return;
            }
            void continuityService
              .consolidateNow(activeConversationId)
              .then(() => refresh())
              .catch((error: unknown) => {
                onError(normalizeStorageError(error));
              });
          }}
          disabled={!activeConversationId || !preferences.consolidationEnabled}
        >
          Consolidate now
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!preferences.semanticMemoryEnabled}
          onClick={() =>
            void continuityService
              .reembed()
              .then((count) => {
                onNotice(`Re-embedded ${String(count)} continuity records.`);
                return refresh();
              })
              .catch((error: unknown) => {
                onError(normalizeStorageError(error));
              })
          }
        >
          Re-embed
        </button>
        <button type="button" className="stop-button" onClick={() => void deleteAll()}>
          Delete all continuity
        </button>
      </div>

      {loading ? <p className="muted">Loading local continuity…</p> : null}
      <ContinuitySection title="Conversation Summaries" empty="No summaries yet.">
        {snapshot?.summaries.map((summary) => (
          <article key={summary.id}>
            <strong>Conversation summary v{String(summary.summaryVersion)}</strong>
            <p>{summary.summary.currentTopics.join(' · ') || 'No current topics.'}</p>
            {summary.summary.unresolvedItems.length > 0 ? (
              <p>Unresolved: {summary.summary.unresolvedItems.join(' · ')}</p>
            ) : null}
            <small>
              Source conversation {summary.conversationId} through{' '}
              {summary.summarizedThroughMessageId}; {summary.modelProvider}/{summary.modelName}
            </small>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void continuityService
                  .deleteSummary(summary.id)
                  .then(() => refresh())
                  .catch((error: unknown) => {
                    onError(normalizeStorageError(error));
                  })
              }
            >
              Delete summary
            </button>
          </article>
        ))}
      </ContinuitySection>

      <ContinuitySection title="Episodes" empty="No episodes yet.">
        {snapshot?.episodes.map((episode) => (
          <article key={episode.id}>
            <strong>{episode.title}</strong>
            <p>{episode.summary}</p>
            <small>
              {episode.category.replaceAll('_', ' ')} · {episode.status.replaceAll('_', ' ')} ·
              sources {episode.sourceMessageIds.join(', ') || 'unavailable'} · used{' '}
              {String(episode.useCount)} times
            </small>
            <div className="button-row">
              <button
                type="button"
                onClick={() => {
                  void editEpisode(episode);
                }}
              >
                Correct
              </button>
              {episode.status === 'proposed' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void updateEpisode(episode, 'confirmed');
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void updateEpisode(episode, 'rejected');
                    }}
                  >
                    Reject
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="stop-button"
                onClick={() =>
                  void continuityService
                    .deleteEpisode(episode.id)
                    .then(() => refresh())
                    .catch((error: unknown) => {
                      onError(normalizeStorageError(error));
                    })
                }
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </ContinuitySection>

      <ContinuitySection title="People and Projects" empty="No entities yet.">
        {snapshot?.entities.map((entity) => (
          <article key={entity.id}>
            <strong>{entity.canonicalName}</strong>
            <p>
              {entity.entityType} · aliases: {entity.aliases.join(', ') || 'none'}
            </p>
            <small>
              {entity.status} · used {String(entity.useCount)} times
            </small>
            <button
              type="button"
              className="stop-button"
              onClick={() =>
                void continuityService
                  .deleteEntity(entity.id)
                  .then(() => refresh())
                  .catch((error: unknown) => {
                    onError(normalizeStorageError(error));
                  })
              }
            >
              Delete
            </button>
          </article>
        ))}
      </ContinuitySection>

      <ContinuitySection title="Current Life" empty="No active context.">
        {snapshot?.currentLifeContext.map((item) => (
          <article key={item.id}>
            <strong>{item.category.replaceAll('_', ' ')}</strong>
            <p>{item.content}</p>
            <small>
              {item.status} · source{' '}
              {item.sourceMessageId ?? item.sourceConversationId ?? 'unknown'}
            </small>
            <button
              type="button"
              className="stop-button"
              onClick={() =>
                void continuityService
                  .deleteCurrentLifeItem(item.id)
                  .then(() => refresh())
                  .catch((error: unknown) => {
                    onError(normalizeStorageError(error));
                  })
              }
            >
              Delete
            </button>
          </article>
        ))}
      </ContinuitySection>

      <ContinuitySection title="Consolidation Jobs" empty="No jobs yet.">
        {snapshot?.jobs.map((job) => (
          <article key={job.id}>
            <strong>{job.status}</strong>
            <p>
              {job.sourceType} {job.sourceId} · attempt {String(job.attemptCount)}
            </p>
            <small>{job.lastErrorCode ?? 'No error'}</small>
            {job.status === 'pending' || job.status === 'running' ? (
              <button
                type="button"
                onClick={() =>
                  void continuityService
                    .cancelJob(job.id)
                    .then(() => refresh())
                    .catch((error: unknown) => {
                      onError(normalizeStorageError(error));
                    })
                }
              >
                Cancel
              </button>
            ) : null}
            {job.status === 'failed' || job.status === 'cancelled' ? (
              <button
                type="button"
                onClick={() =>
                  void continuityService
                    .retryJob(job.id)
                    .then(() => refresh())
                    .catch((error: unknown) => {
                      onError(normalizeStorageError(error));
                    })
                }
              >
                Retry
              </button>
            ) : null}
          </article>
        ))}
      </ContinuitySection>
    </section>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
      {label}
    </label>
  );
}

function ContinuitySection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <details className="continuity-section">
      <summary>
        {title} ({String(items.length)})
      </summary>
      <div>{items.length > 0 ? children : <p className="muted">{empty}</p>}</div>
    </details>
  );
}
