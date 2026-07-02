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

export interface AgentSessionSubmitRequest {
  localConversationId: string | null;
  requestId: string;
  turnId: string;
  text: string;
  model: string;
  temporary: boolean;
  hiddenContext: string;
}

export interface AgentSessionRetryRequest {
  requestId: string;
  turnId: string;
  model: string;
  hiddenContext: string;
}

export interface AgentRuntimeDiagnostics {
  status: 'stopped' | 'starting' | 'ready' | 'reconnecting' | 'offline' | 'failed' | 'stopping';
  processId: number | null;
  restartCount: number;
  lastError: string | null;
}

export interface AgentSessionService {
  diagnostics(): Promise<AgentRuntimeDiagnostics>;
  snapshot(): Promise<AgentSessionSnapshot>;
  start(): Promise<AgentSessionSnapshot>;
  retryConnection(): Promise<AgentSessionSnapshot>;
  open(request: AgentSessionOpenRequest): Promise<AgentSessionSnapshot>;
  submit(request: AgentSessionSubmitRequest): Promise<AgentSessionSnapshot>;
  retry(request: AgentSessionRetryRequest): Promise<AgentSessionSnapshot>;
  setSupportMode(supportMode: CompanionSupportMode): Promise<AgentSessionSnapshot>;
  interrupt(): Promise<AgentSessionSnapshot>;
  close(): Promise<AgentSessionSnapshot>;
  purgeConversation(conversationId: string): Promise<boolean>;
  purgeAll(): Promise<number>;
  stop(): Promise<void>;
  subscribeSnapshot(handler: (snapshot: AgentSessionSnapshot) => void): Promise<UnlistenFn>;
  subscribeStream(handler: (event: AgentStreamEvent) => void): Promise<UnlistenFn>;
}

export const tauriAgentSessionService: AgentSessionService = {
  async diagnostics() {
    ensureTauri();
    const value = await invoke<unknown>('agent_runtime_status');
    if (!isRuntimeDiagnostics(value)) {
      throw new Error('Invalid companion runtime diagnostics response.');
    }
    return value;
  },
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
  submit(request) {
    return invokeSnapshot('agent_session_submit', { request });
  },
  retry(request) {
    return invokeSnapshot('agent_session_retry', { request });
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
  async purgeConversation(conversationId) {
    ensureTauri();
    const value = await invoke<unknown>('agent_session_purge_conversation', { conversationId });
    if (typeof value !== 'boolean') {
      throw new Error('Invalid companion cleanup response.');
    }
    return value;
  },
  async purgeAll() {
    ensureTauri();
    const value = await invoke<unknown>('agent_session_purge_all');
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error('Invalid companion cleanup response.');
    }
    return value;
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
    throw new Error('The shared companion session is available in the desktop application.');
  }
}

function hasTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

function isRuntimeDiagnostics(value: unknown): value is AgentRuntimeDiagnostics {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  return (
    typeof diagnostics.status === 'string' &&
    ['stopped', 'starting', 'ready', 'reconnecting', 'offline', 'failed', 'stopping'].includes(
      diagnostics.status,
    ) &&
    (diagnostics.processId === null ||
      (Number.isSafeInteger(diagnostics.processId) && (diagnostics.processId as number) > 0)) &&
    Number.isSafeInteger(diagnostics.restartCount) &&
    (diagnostics.restartCount as number) >= 0 &&
    (diagnostics.lastError === null ||
      (typeof diagnostics.lastError === 'string' && diagnostics.lastError.length <= 500))
  );
}
