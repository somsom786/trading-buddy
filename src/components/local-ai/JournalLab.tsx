import { useState } from 'react';
import type { JournalDiagnostics, JournalEntrySummary } from '../../domain/journal/types';

interface JournalLabProps {
  diagnostics: JournalDiagnostics | null;
  onRefresh: () => void;
  onGenerateFixtures: (count: number) => Promise<void>;
  onDeleteFixtures: () => Promise<void>;
  onSearch: (query: string) => Promise<JournalEntrySummary[]>;
}

export function JournalLab({
  diagnostics,
  onRefresh,
  onGenerateFixtures,
  onDeleteFixtures,
  onSearch,
}: JournalLabProps) {
  const [query, setQuery] = useState('fixture');
  const [results, setResults] = useState<JournalEntrySummary[]>([]);

  return (
    <details className="storage-lab journal-lab">
      <summary>Journal Lab · development only</summary>
      <div className="storage-lab__content">
        <div className="button-row">
          <button type="button" onClick={onRefresh}>
            Refresh journal diagnostics
          </button>
          <button
            type="button"
            onClick={() => {
              void onGenerateFixtures(100);
            }}
          >
            Generate 100 fixtures
          </button>
          <button
            type="button"
            onClick={() => {
              void onGenerateFixtures(1000);
            }}
          >
            Generate 1,000 fixtures
          </button>
          <button
            type="button"
            onClick={() => {
              void onDeleteFixtures();
            }}
          >
            Delete fixtures
          </button>
        </div>
        <dl>
          <dt>Total / completed / drafts</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.totalCount)} / ${String(
                  diagnostics.completedCount,
                )} / ${String(diagnostics.draftCount)}`
              : '0 / 0 / 0'}
          </dd>
          <dt>Private / fixtures / tags</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.privateCount)} / ${String(
                  diagnostics.fixtureCount,
                )} / ${String(diagnostics.tagCount)}`
              : '0 / 0 / 0'}
          </dd>
          <dt>FTS</dt>
          <dd>{diagnostics?.ftsAvailable ? 'available' : 'unavailable'}</dd>
        </dl>
        <label className="field">
          Search fixture entries
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void onSearch(query).then(setResults);
          }}
        >
          Run search
        </button>
        <ul>
          {results.map((entry) => (
            <li key={entry.id}>{entry.title}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
