import { useEffect, useState } from 'react';
import type { AgentSessionSnapshot } from '../../domain/agent-session/types';
import type {
  AgentRuntimeDiagnostics,
  AgentSessionService,
} from '../../services/tauri/agentSessionService';

interface AgentSessionLabProps {
  snapshot: AgentSessionSnapshot;
  service: AgentSessionService;
}

export function AgentSessionLab({ snapshot, service }: AgentSessionLabProps) {
  const [diagnostics, setDiagnostics] = useState<AgentRuntimeDiagnostics | null>(null);
  const refresh = () => {
    void service
      .diagnostics()
      .then(setDiagnostics)
      .catch(() => {
        setDiagnostics(null);
      });
  };

  useEffect(refresh, [service]);

  return (
    <details className="diagnostic-panel">
      <summary>Agent Session Lab</summary>
      <dl>
        <dt>Gateway</dt>
        <dd>{diagnostics?.status ?? snapshot.connectionStatus}</dd>
        <dt>Process ID</dt>
        <dd>{diagnostics?.processId ?? 'none'}</dd>
        <dt>Restarts</dt>
        <dd>{diagnostics?.restartCount ?? snapshot.diagnostics.reconnectCount}</dd>
        <dt>Conversation</dt>
        <dd>{snapshot.localConversationId ?? 'none'}</dd>
        <dt>Remote session</dt>
        <dd>{snapshot.hermesSessionId ?? 'none'}</dd>
        <dt>Remote key</dt>
        <dd>{redactKey(snapshot.hermesSessionKey)}</dd>
        <dt>Request / turn</dt>
        <dd>
          {snapshot.activeRequestId ?? 'none'} / {snapshot.activeTurnId ?? 'none'}
        </dd>
        <dt>Sequence / mode / stream</dt>
        <dd>
          {snapshot.lastSequence} / {snapshot.supportMode} / {snapshot.turnStatus}
        </dd>
        <dt>Duplicate / stale</dt>
        <dd>
          {snapshot.diagnostics.duplicateEventCount} / {snapshot.diagnostics.staleEventCount}
        </dd>
        <dt>Last sanitized error</dt>
        <dd>{diagnostics?.lastError ?? snapshot.recoverableError?.userMessage ?? 'none'}</dd>
      </dl>
      <div className="button-row">
        <button type="button" onClick={() => void service.start().then(refresh)}>
          Start backend
        </button>
        <button type="button" onClick={() => void service.stop().then(refresh)}>
          Stop backend
        </button>
        <button type="button" onClick={() => void service.retryConnection().then(refresh)}>
          Restart backend
        </button>
        <button type="button" onClick={() => void service.interrupt().then(refresh)}>
          Interrupt
        </button>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
    </details>
  );
}

function redactKey(value: string | null): string {
  return value ? `...${value.slice(-6)}` : 'none';
}
