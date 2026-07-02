import type { AgentConnectionStatus } from '../../domain/agent-session/types';
import { AGENT_PROVIDER_CONFIG } from '../../domain/agent-session/provider';

interface AgentProviderPanelProps {
  status: AgentConnectionStatus;
  error: string | null;
  onRetry: () => void;
}

export function AgentProviderPanel({ status, error, onRetry }: AgentProviderPanelProps) {
  const ready = status === 'ready';
  const pending = status === 'starting' || status === 'connecting' || status === 'reconnecting';

  return (
    <section className={`local-ai-panel agent-provider-panel agent-provider-panel--${status}`}>
      <span className="connection-dot" aria-hidden="true" />
      <div>
        <strong>
          {AGENT_PROVIDER_CONFIG.modelLabel} · {AGENT_PROVIDER_CONFIG.provider}
        </strong>
        <span>
          {ready
            ? 'Cloud companion ready'
            : pending
              ? 'Connecting cloud companion…'
              : 'Cloud companion offline'}
        </span>
      </div>
      {!ready && !pending ? (
        <button type="button" className="text-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      {error ? <span className="agent-provider-panel__error">{error}</span> : null}
      <small>{AGENT_PROVIDER_CONFIG.cloudDisclosure}</small>
    </section>
  );
}
