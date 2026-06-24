import type { Memory } from '../../domain/memory/types';

interface MemoryProposalCardProps {
  memory: Memory;
  compact?: boolean;
  onRemember: (memory: Memory) => void | Promise<void>;
  onEdit: (memory: Memory) => void | Promise<void>;
  onReject: (memory: Memory) => void | Promise<void>;
}

export function MemoryProposalCard({
  memory,
  compact = false,
  onRemember,
  onEdit,
  onReject,
}: MemoryProposalCardProps) {
  return (
    <section className={compact ? 'memory-proposal memory-proposal--compact' : 'memory-proposal'}>
      <p className="memory-proposal__eyebrow">Buddy wants to remember</p>
      <blockquote>“{memory.content}”</blockquote>
      <p className="memory-proposal__meta">
        {memory.category.replaceAll('_', ' ')} · {memory.sensitivity}
      </p>
      <div className="button-row">
        <button type="button" onClick={() => void onRemember(memory)}>
          Remember
        </button>
        <button type="button" className="secondary-button" onClick={() => void onEdit(memory)}>
          Edit
        </button>
        <button type="button" className="secondary-button" onClick={() => void onReject(memory)}>
          Not now
        </button>
      </div>
    </section>
  );
}
