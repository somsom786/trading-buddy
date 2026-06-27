import { useState } from 'react';
import type { ContinuityRetrievalResult, ContinuitySnapshot } from '../../domain/continuity/types';
import type { ContinuityService } from '../../services/tauri/continuityService';

interface ContinuityLabProps {
  activeConversationId: string | null;
  continuityService: ContinuityService;
}

export function ContinuityLab({ activeConversationId, continuityService }: ContinuityLabProps) {
  const [query, setQuery] = useState('What was unresolved with that farming game?');
  const [retrieval, setRetrieval] = useState<ContinuityRetrievalResult | null>(null);
  const [snapshot, setSnapshot] = useState<ContinuitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <details className="buddy-lab">
      <summary>Continuity Lab</summary>
      <p>
        Development-only inspection for FarmTown, paraphrase retrieval, job recovery, corrections,
        deletion, and lexical fallback. It never displays prompts or hidden reasoning.
      </p>
      <label>
        Retrieval query
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
        />
      </label>
      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              setRetrieval(await continuityService.retrieve({ query, limit: 8 }));
            })
          }
        >
          Run hybrid retrieval
        </button>
        <button
          type="button"
          disabled={!activeConversationId}
          onClick={() =>
            void run(async () => {
              if (activeConversationId) {
                await continuityService.consolidateNow(activeConversationId);
              }
              setSnapshot(await continuityService.snapshot());
            })
          }
        >
          Consolidate current chat
        </button>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              setSnapshot(await continuityService.snapshot());
            })
          }
        >
          Simulate restart read
        </button>
      </div>
      {retrieval ? (
        <pre>
          {JSON.stringify(
            {
              semanticStatus: retrieval.semanticStatus,
              queryEmbeddingUsed: retrieval.queryEmbeddingUsed,
              candidateCount: retrieval.candidateCount,
              items: retrieval.items.map((item) => ({
                source: `${item.sourceType}:${item.sourceId}`,
                score: item.score,
                reasons: item.reasonCodes,
                content: item.content,
              })),
            },
            null,
            2,
          )}
        </pre>
      ) : null}
      {snapshot ? (
        <pre>
          {JSON.stringify(
            {
              summaries: snapshot.summaries.length,
              episodes: snapshot.episodes.length,
              entities: snapshot.entities.length,
              currentLife: snapshot.currentLifeContext.length,
              jobs: snapshot.jobs,
              semanticStatus: snapshot.semanticStatus,
              embeddings: snapshot.embeddingCount,
              staleEmbeddings: snapshot.staleEmbeddingCount,
            },
            null,
            2,
          )}
        </pre>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </details>
  );
}
