import { useCallback, useEffect, useReducer, useState } from 'react';
import { agentSessionReducer } from '../../domain/agent-session/reducer';
import {
  INITIAL_AGENT_SESSION_SNAPSHOT,
  type AgentSessionSnapshot,
  type CompanionSupportMode,
} from '../../domain/agent-session/types';
import {
  tauriAgentSessionService,
  type AgentSessionOpenRequest,
  type AgentSessionService,
  type AgentSessionSubmitRequest,
} from '../../services/tauri/agentSessionService';

export interface AgentSessionController {
  snapshot: AgentSessionSnapshot;
  loading: boolean;
  error: string | null;
  start(): Promise<void>;
  open(request: AgentSessionOpenRequest): Promise<void>;
  submit(request: AgentSessionSubmitRequest): Promise<void>;
  setSupportMode(mode: CompanionSupportMode): Promise<void>;
  interrupt(): Promise<void>;
  retryConnection(): Promise<void>;
}

export function useAgentSession(
  service: AgentSessionService = tauriAgentSessionService,
): AgentSessionController {
  const [snapshot, dispatch] = useReducer(agentSessionReducer, INITIAL_AGENT_SESSION_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const unlisten: (() => void)[] = [];
    void Promise.all([
      service.subscribeSnapshot((next) => {
        dispatch({ type: 'replace_snapshot', snapshot: next });
      }),
      service.subscribeStream((event) => {
        dispatch({ type: 'stream_event', event });
      }),
      service.snapshot(),
    ])
      .then(([unlistenSnapshot, unlistenStream, initial]) => {
        if (disposed) {
          unlistenSnapshot();
          unlistenStream();
          return;
        }
        unlisten.push(unlistenSnapshot, unlistenStream);
        dispatch({ type: 'replace_snapshot', snapshot: initial });
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      unlisten.forEach((stop) => {
        stop();
      });
    };
  }, [service]);

  const run = useCallback(async (operation: () => Promise<AgentSessionSnapshot>) => {
    setError(null);
    try {
      const next = await operation();
      dispatch({ type: 'replace_snapshot', snapshot: next });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  return {
    snapshot,
    loading,
    error,
    start: () => run(() => service.start()),
    open: (request) => run(() => service.open(request)),
    submit: (request) => run(() => service.submit(request)),
    setSupportMode: (mode) => run(() => service.setSupportMode(mode)),
    interrupt: () => run(() => service.interrupt()),
    retryConnection: () => run(() => service.retryConnection()),
  };
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : 'The local agent session is unavailable.';
}
