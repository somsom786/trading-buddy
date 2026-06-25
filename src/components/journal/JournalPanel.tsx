import { useCallback, useEffect, useState } from 'react';
import { normalizeStorageError, type StorageError } from '../../domain/storage/types';
import type {
  JournalEntry,
  JournalEntrySummary,
  JournalKind,
  JournalListOptions,
} from '../../domain/journal/types';
import type { StorageService } from '../../services/tauri/storageService';

interface JournalPanelProps {
  storageService: StorageService;
  onNotice: (message: string) => void;
  onError: (error: StorageError) => void;
}

const kindOptions: (JournalKind | 'all')[] = [
  'all',
  'free_reflection',
  'daily_check_in',
  'end_of_day_review',
  'idea',
  'trading_session',
  'life',
  'money',
  'decision',
  'other',
];

export function JournalPanel({ storageService, onNotice, onError }: JournalPanelProps) {
  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<JournalKind | 'all'>('all');
  const [showDrafts, setShowDrafts] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const options: JournalListOptions = {
        includePrivate: true,
        includeDiscarded: false,
        sort: 'newest',
        limit: 50,
        offset: 0,
      };
      if (showDrafts) {
        options.status = 'draft';
      }
      if (kind !== 'all') {
        options.kind = kind;
      }
      const trimmedQuery = query.trim();
      if (trimmedQuery) {
        options.query = trimmedQuery;
      }
      setEntries(await storageService.listJournalEntries(options));
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  }, [kind, onError, query, showDrafts, storageService]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const open = async (entryId: string) => {
    setBusy(true);
    try {
      setSelected(await storageService.getJournalEntry(entryId));
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  const editSelected = async () => {
    if (!selected) {
      return;
    }
    const body = window.prompt('Edit journal entry body', selected.body);
    if (body === null) {
      return;
    }
    setBusy(true);
    try {
      const updated = await storageService.updateJournalEntry({
        entryId: selected.id,
        kind: selected.kind,
        title: selected.title,
        body,
        status: selected.status,
        allowMemoryCandidates: selected.allowMemoryCandidates,
        isPrivate: selected.isPrivate,
        tags: selected.tags,
        expectedUpdatedAt: selected.updatedAt,
        ...(selected.summary ? { summary: selected.summary } : {}),
        ...(selected.mood !== undefined ? { mood: selected.mood } : {}),
        ...(selected.energy !== undefined ? { energy: selected.energy } : {}),
        ...(selected.stress !== undefined ? { stress: selected.stress } : {}),
        ...(selected.confidence !== undefined ? { confidence: selected.confidence } : {}),
      });
      setSelected(updated);
      onNotice('Journal entry updated.');
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (
      !selected ||
      !window.confirm('Delete this journal entry? Memories and conversations remain.')
    ) {
      return;
    }
    setBusy(true);
    try {
      await storageService.deleteJournalEntry(selected.id);
      setSelected(null);
      onNotice('Journal entry deleted.');
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (window.prompt('Type DELETE JOURNAL to delete all journal entries.') !== 'DELETE JOURNAL') {
      return;
    }
    setBusy(true);
    try {
      const result = await storageService.deleteAllJournalEntries();
      setSelected(null);
      onNotice(`Deleted ${String(result.deletedEntries)} journal entry record(s).`);
      await refresh();
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  const exportJournal = async (format: 'json' | 'markdown') => {
    const includePrivate = window.confirm('Include private journal entries in this local export?');
    setBusy(true);
    try {
      const result =
        format === 'json'
          ? await storageService.exportJournalJson(includePrivate)
          : await storageService.exportJournalMarkdown(includePrivate);
      onNotice(
        result
          ? `Exported ${String(result.exportedEntries)} entries to ${result.fileName}.`
          : 'Journal export cancelled.',
      );
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="journal-panel" aria-labelledby="journal-panel-title">
      <header className="memory-panel__header">
        <div>
          <p className="eyebrow">Private local journal</p>
          <h2 id="journal-panel-title">Journal</h2>
          <p>
            Journal entries are separate from chat history and memory unless you explicitly opt in.
          </p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void exportJournal('json');
            }}
            disabled={busy}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void exportJournal('markdown');
            }}
            disabled={busy}
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="stop-button"
            onClick={() => {
              void deleteAll();
            }}
            disabled={busy}
          >
            Delete all journal
          </button>
        </div>
      </header>

      <div className="memory-filters">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          placeholder="Search journal"
        />
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.currentTarget.value as JournalKind | 'all');
          }}
        >
          {kindOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={showDrafts}
            onChange={(event) => {
              setShowDrafts(event.currentTarget.checked);
            }}
          />
          Drafts only
        </label>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      <div className="journal-layout">
        <div className="memory-list">
          {entries.length === 0 ? <p className="muted">No journal entries found.</p> : null}
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="journal-list-item"
              onClick={() => {
                void open(entry.id);
              }}
            >
              <strong>{entry.title}</strong>
              <span>
                {entry.kind.replaceAll('_', ' ')} · {new Date(entry.occurredAt).toLocaleString()}
              </span>
              <small>{entry.preview}</small>
            </button>
          ))}
        </div>

        <article className="journal-entry-detail">
          {selected ? (
            <>
              <h3>{selected.title}</h3>
              <p className="muted">
                {selected.kind.replaceAll('_', ' ')} · {selected.status} ·{' '}
                {selected.isPrivate ? 'private' : 'not private'}
              </p>
              {selected.summary ? <p>{selected.summary}</p> : null}
              <pre>{selected.body}</pre>
              <p className="muted">
                Tags: {selected.tags.length > 0 ? selected.tags.join(', ') : 'none'} · Memory
                suggestions: {selected.allowMemoryCandidates ? 'allowed' : 'off'}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => {
                    void editSelected();
                  }}
                  disabled={busy}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="stop-button"
                  onClick={() => {
                    void deleteSelected();
                  }}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Select an entry to read it.</p>
          )}
        </article>
      </div>
    </section>
  );
}
