import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isAgentStreamEvent, type AgentStreamEvent } from '../../domain/agent-session/events';
import { isAgentSessionSnapshot } from '../../domain/agent-session/protocol';
import type { AgentSessionSnapshot, CompanionSupportMode } from '../../domain/agent-session/types';

export const AGENT_SESSION_EVENT_NAMES = {
  snapshot: 'agent://session-snapshot',
  stream: 'agent://stream-event',
} as const;

export interface AgentSessionOpenRequest {
  localConversationId: string | null;
  model: string;
  temporary: boolean;
}

export interface AgentSessionService {
  snapshot(): Promise<AgentSessionSnapshot>;
  start(): Promise<AgentSessionSnapshot>;
  retryConnection(): Promise<AgentSessionSnapshot>;
  open(request: AgentSessionOpenRequest): Promise<AgentSessionSnapshot>;
  setSupportMode(supportMode: CompanionSupportMode): Promise<AgentSessionSnapshot>;
  interrupt(): Promise<AgentSessionSnapshot>;
  close(): Promise<AgentSessionSnapshot>;
  stop(): Promise<void>;
  subscribeSnapshot(handler: (snapshot: AgentSessionSnapshot) => void): Promise<UnlistenFn>;
  subscribeStream(handler: (event: AgentStreamEvent) => void): Promise<UnlistenFn>;
}

export const tauriAgentSessionService: AgentSessionService = {
  snapshot() {
    return invokeSnapshot('agent_session_snapshot');
  },
  start() {
    return invokeSnapshot('agent_runtime_start');
  },
  retryConnection() {
    return invokeSnapshot('agent_runtime_retry_connection');
  },
  open(request) {
    return invokeSnapshot('agent_session_open', { request });
  },
  setSupportMode(supportMode) {
    return invokeSnapshot('agent_session_set_support_mode', { supportMode });
  },
  interrupt() {
    return invokeSnapshot('agent_session_interrupt');
  },
  close() {
    return invokeSnapshot('agent_session_close');
  },
  async stop() {
    ensureTauri();
    await invoke('agent_runtime_stop');
  },
  async subscribeSnapshot(handler) {
    if (!hasTauri()) {
      return () => undefined;
    }
    return listen<unknown>(AGENT_SESSION_EVENT_NAMES.snapshot, (event) => {
      if (isAgentSessionSnapshot(event.payload)) {
        handler(event.payload);
      }
    });
  },
  async subscribeStream(handler) {
    if (!hasTauri()) {
      return () => undefined;
    }
    return listen<unknown>(AGENT_SESSION_EVENT_NAMES.stream, (event) => {
      if (isAgentStreamEvent(event.payload)) {
        handler(event.payload);
      }
    });
  },
};

async function invokeSnapshot(
  command: string,
  args?: Record<string, unknown>,
): Promise<AgentSessionSnapshot> {
  ensureTauri();
  const value = await invoke<unknown>(command, args);
  if (!isAgentSessionSnapshot(value)) {
    throw new Error(`Invalid shared agent session response from ${command}.`);
  }
  return value;
}

function ensureTauri(): void {
  if (!hasTauri()) {
    throw new Error('The shared local agent session is available in the desktop application.');
  }
}

function hasTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}
