import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultMemoryPreferences,
  memoryCategories,
  memorySensitivities,
  type Memory,
  type MemoryCategory,
  type MemoryPreferences,
  type MemorySensitivity,
  type MemoryStatus,
} from '../../domain/memory/types';
import {
  normalizeStorageError,
  type MemoryExportResult,
  type StorageError,
} from '../../domain/storage/types';
import type { StorageService } from '../../services/tauri/storageService';
import { MemoryProposalCard } from './MemoryProposalCard';

interface MemoryPanelProps {
  storageService: StorageService;
  onNotice: (message: string) => void;
  onError: (error: StorageError) => void;
}

type MemoryTab = 'confirmed' | 'proposed' | 'expiring' | 'rejected' | 'settings';
type SortMode = 'updated' | 'used';

export function MemoryPanel({ storageService, onNotice, onError }: MemoryPanelProps) {
  const [tab, setTab] = useState<MemoryTab>('confirmed');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [preferences, setPreferences] = useState<MemoryPreferences>(defaultMemoryPreferences);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MemoryCategory | 'all'>('all');
  const [sensitivity, setSensitivity] = useState<MemorySensitivity | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('updated');
  const [lastExport, setLastExport] = useState<MemoryExportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [settings, all] = await Promise.all([
        storageService.getSettings(),
        storageService.listMemories({ limit: 100 }),
      ]);
      setPreferences(settings.memoryPreferences);
      setMemories(all);
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  }, [onError, storageService]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const visibleMemories = useMemo(() => {
    const status = statusForTab(tab);
    return memories
      .filter((memory) => (status ? memory.status === status : true))
      .filter((memory) =>
        tab === 'expiring' ? memory.expiresAt && memory.status !== 'expired' : true,
      )
      .filter((memory) => (category === 'all' ? true : memory.category === category))
      .filter((memory) => (sensitivity === 'all' ? true : memory.sensitivity === sensitivity))
      .filter((memory) =>
        query.trim() ? memory.normalizedContent.includes(query.trim().toLocaleLowerCase()) : true,
      )
      .slice()
      .sort((a, b) => {
        const aDate = sort === 'used' ? (a.lastUsedAt ?? '') : a.updatedAt;
        const bDate = sort === 'used' ? (b.lastUsedAt ?? '') : b.updatedAt;
        return bDate.localeCompare(aDate) || a.id.localeCompare(b.id);
      });
  }, [category, memories, query, sensitivity, sort, tab]);

  const updatePreferences = async (next: MemoryPreferences) => {
    try {
      const settings = await storageService.setMemoryPreferences(next);
      setPreferences(settings.memoryPreferences);
      onNotice('Memory settings saved.');
    } catch (error) {
      onError(normalizeStorageError(error));
    }
  };

  const confirm = async (memory: Memory) => {
    await runAction(async () => {
      await storageService.confirmMemory(memory.id);
      onNotice('Memory confirmed. Buddy may use it when relevant.');
      await refresh();
    });
  };

  const reject = async (memory: Memory) => {
    await runAction(async () => {
      await storageService.rejectMemory(memory.id);
      onNotice('Memory proposal dismissed. Buddy will not use it.');
      await refresh();
    });
  };

  const restore = async (memory: Memory) => {
    await runAction(async () => {
      await storageService.restoreMemory(memory.id);
      onNotice('Memory restored. Buddy may use it when relevant.');
      await refresh();
    });
  };

  const edit = async (memory: Memory) => {
    const content = window.prompt('Edit memory', memory.content);
    if (content === null) {
      return;
    }
    await runAction(async () => {
      await storageService.updateMemoryContent({
        memoryId: memory.id,
        content,
        category: memory.category,
        sensitivity: memory.sensitivity,
        expiresAt: memory.expiresAt,
      });
      onNotice('Memory updated.');
      await refresh();
    });
  };

  const deleteMemory = async (memory: Memory) => {
    if (!window.confirm('Delete this memory? This does not delete conversation history.')) {
      return;
    }
    await runAction(async () => {
      await storageService.deleteMemory(memory.id);
      onNotice('Memory deleted.');
      await refresh();
    });
  };

  const removeExpiry = async (memory: Memory) => {
    await runAction(async () => {
      await storageService.updateMemoryExpiry({ memoryId: memory.id });
      onNotice('Memory expiry removed.');
      await refresh();
    });
  };

  const deleteAll = async () => {
    if (
      window.prompt('Type DELETE MEMORIES to delete all companion memories.') !== 'DELETE MEMORIES'
    ) {
      return;
    }
    await runAction(async () => {
      const result = await storageService.deleteAllMemories();
      onNotice(`Deleted ${String(result.deletedMemories)} memory record(s).`);
      await refresh();
    });
  };

  const exportMemories = async (includeSensitive: boolean) => {
    await runAction(async () => {
      const result = await storageService.exportMemories(includeSensitive);
      if (result) {
        setLastExport(result);
        onNotice(
          `Exported ${String(result.exportedMemories)} memory record(s) to ${result.fileName}.`,
        );
      } else {
        onNotice('Memory export cancelled.');
      }
    });
  };

  const runAction = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="memory-panel" aria-labelledby="memory-panel-title">
      <header className="memory-panel__header">
        <div>
          <h2 id="memory-panel-title">What Buddy Knows About Me</h2>
          <p>Your buddy only uses confirmed memories. You can edit or delete anything here.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            void refresh();
          }}
          disabled={busy}
        >
          Refresh
        </button>
      </header>

      <nav className="memory-tabs" aria-label="Memory views">
        {(['confirmed', 'proposed', 'expiring', 'rejected', 'settings'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'memory-tabs__active' : ''}
            onClick={() => {
              setTab(item);
            }}
          >
            {item === 'proposed' ? 'Pending proposals' : item}
          </button>
        ))}
      </nav>

      {tab === 'settings' ? (
        <div className="memory-settings">
          <label>
            <input
              type="checkbox"
              checked={preferences.memoryEnabled}
              onChange={(event) => {
                void updatePreferences({
                  ...preferences,
                  memoryEnabled: event.currentTarget.checked,
                });
              }}
            />
            Enable memory retrieval and proposals
          </label>
          <label>
            Approval mode
            <select
              value={preferences.memoryApprovalMode}
              onChange={(event) => {
                void updatePreferences({
                  ...preferences,
                  memoryApprovalMode: event.currentTarget
                    .value as MemoryPreferences['memoryApprovalMode'],
                });
              }}
            >
              <option value="ask_every_time">Ask every time</option>
              <option value="auto_save_ordinary">Auto-save ordinary only</option>
              <option value="manual_only">Manual only</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.allowPersonalMemories}
              onChange={(event) => {
                void updatePreferences({
                  ...preferences,
                  allowPersonalMemories: event.currentTarget.checked,
                });
              }}
            />
            Allow personal memories
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.allowSensitiveMemories}
              onChange={(event) => {
                void updatePreferences({
                  ...preferences,
                  allowSensitiveMemories: event.currentTarget.checked,
                });
              }}
            />
            Allow sensitive memories after explicit approval
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.useMemoriesInTemporaryChat}
              onChange={(event) => {
                void updatePreferences({
                  ...preferences,
                  useMemoriesInTemporaryChat: event.currentTarget.checked,
                });
              }}
            />
            Use confirmed memories in temporary chats
          </label>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void exportMemories(false);
              }}
              disabled={busy}
            >
              Export memories
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (window.confirm('Include sensitive memories in this export?')) {
                  void exportMemories(true);
                }
              }}
              disabled={busy}
            >
              Export incl. sensitive
            </button>
            <button
              type="button"
              className="stop-button"
              onClick={() => {
                void deleteAll();
              }}
              disabled={busy}
            >
              Delete all memories
            </button>
          </div>
          {lastExport ? <p className="muted">Last memory export: {lastExport.fileName}</p> : null}
        </div>
      ) : (
        <>
          <div className="memory-filters">
            <input
              type="search"
              placeholder="Search memories"
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
              }}
            />
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.currentTarget.value as MemoryCategory | 'all');
              }}
            >
              <option value="all">All categories</option>
              {[...memoryCategories].map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={sensitivity}
              onChange={(event) => {
                setSensitivity(event.currentTarget.value as MemorySensitivity | 'all');
              }}
            >
              <option value="all">All sensitivity</option>
              {[...memorySensitivities]
                .filter((item) => item !== 'prohibited')
                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.currentTarget.value as SortMode);
              }}
            >
              <option value="updated">Recently updated</option>
              <option value="used">Recently used</option>
            </select>
          </div>

          <div className="memory-list">
            {visibleMemories.length === 0 ? (
              <p className="muted">No memories in this view yet.</p>
            ) : null}
            {visibleMemories.map((memory) =>
              memory.status === 'proposed' ? (
                <MemoryProposalCard
                  key={memory.id}
                  memory={memory}
                  onRemember={confirm}
                  onEdit={edit}
                  onReject={reject}
                />
              ) : (
                <article key={memory.id} className="memory-row">
                  <p>{memory.content}</p>
                  <dl>
                    <dt>Category</dt>
                    <dd>{memory.category.replaceAll('_', ' ')}</dd>
                    <dt>Sensitivity</dt>
                    <dd>{memory.sensitivity}</dd>
                    <dt>Source</dt>
                    <dd>{memory.sourceKind.replaceAll('_', ' ')}</dd>
                    <dt>Updated</dt>
                    <dd>{new Date(memory.updatedAt).toLocaleString()}</dd>
                    <dt>Last used</dt>
                    <dd>
                      {memory.lastUsedAt ? new Date(memory.lastUsedAt).toLocaleString() : 'Never'}
                    </dd>
                    <dt>Use count</dt>
                    <dd>{memory.useCount}</dd>
                    <dt>Expiry</dt>
                    <dd>
                      {memory.expiresAt ? new Date(memory.expiresAt).toLocaleString() : 'None'}
                    </dd>
                    {memory.supersedesMemoryId ? (
                      <>
                        <dt>Updates</dt>
                        <dd>{memory.supersedesMemoryId}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="button-row">
                    {memory.status === 'rejected' || memory.status === 'expired' ? (
                      <button
                        type="button"
                        onClick={() => {
                          void restore(memory);
                        }}
                        disabled={busy}
                      >
                        Restore
                      </button>
                    ) : null}
                    {memory.expiresAt ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          void removeExpiry(memory);
                        }}
                        disabled={busy}
                      >
                        Remove expiry
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        void edit(memory);
                      }}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="stop-button"
                      onClick={() => {
                        void deleteMemory(memory);
                      }}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}

function statusForTab(tab: MemoryTab): MemoryStatus | null {
  if (tab === 'confirmed' || tab === 'proposed' || tab === 'rejected') {
    return tab;
  }
  return null;
}
