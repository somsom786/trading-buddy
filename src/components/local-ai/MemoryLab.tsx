import { useState } from 'react';
import type { MemoryDiagnostics, RetrievedMemory } from '../../domain/memory/types';

interface MemoryLabProps {
  diagnostics: MemoryDiagnostics | null;
  onRefresh: () => void;
  onGenerateFixtures: (count: number) => Promise<void>;
  onDeleteFixtures: () => Promise<void>;
  onRetrieve: (query: string) => Promise<RetrievedMemory[]>;
}

export function MemoryLab({
  diagnostics,
  onRefresh,
  onGenerateFixtures,
  onDeleteFixtures,
  onRetrieve,
}: MemoryLabProps) {
  const [query, setQuery] = useState('bounded memory QA');
  const [results, setResults] = useState<RetrievedMemory[]>([]);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const runRetrieval = async () => {
    const started = performance.now();
    const retrieved = await onRetrieve(query);
    setDurationMs(Math.round(performance.now() - started));
    setResults(retrieved);
  };

  return (
    <details className="storage-lab memory-lab">
      <summary>Memory Lab · development only</summary>
      <div className="storage-lab__content">
        <div className="button-row">
          <button type="button" onClick={onRefresh}>
            Refresh memory diagnostics
          </button>
          <button type="button" onClick={() => void onGenerateFixtures(100)}>
            Generate 100 fixtures
          </button>
          <button type="button" onClick={() => void onGenerateFixtures(1000)}>
            Generate 1,000 fixtures
          </button>
          <button type="button" onClick={() => void onDeleteFixtures()}>
            Delete fixtures
          </button>
        </div>

        <dl>
          <dt>Total memories</dt>
          <dd>{diagnostics?.totalCount ?? 0}</dd>
          <dt>Proposed / confirmed</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.proposedCount)} / ${String(diagnostics.confirmedCount)}`
              : '0 / 0'}
          </dd>
          <dt>Rejected / expired / superseded</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.rejectedCount)} / ${String(
                  diagnostics.expiredCount,
                )} / ${String(diagnostics.supersededCount)}`
              : '0 / 0 / 0'}
          </dd>
          <dt>Sensitive</dt>
          <dd>{diagnostics?.sensitiveCount ?? 0}</dd>
          <dt>FTS</dt>
          <dd>{diagnostics?.ftsAvailable ? 'available' : 'unavailable'}</dd>
          <dt>Fixtures</dt>
          <dd>{diagnostics?.fixtureCount ?? 0}</dd>
        </dl>

        <label className="field">
          Retrieval query
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            maxLength={200}
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              void runRetrieval();
            }}
          >
            Test retrieval
          </button>
          <span className="muted">
            {durationMs === null ? 'not run' : `${String(durationMs)} ms`}
          </span>
        </div>
        <ul>
          {results.map((memory) => (
            <li key={memory.id}>
              {memory.category}: {memory.content} ({memory.matchReasons.join(', ')})
            </li>
          ))}
        </ul>
        <p className="muted">
          Fixtures are local debug data. This lab is for memory reliability QA, not a production
          dashboard.
        </p>
      </div>
    </details>
  );
}
