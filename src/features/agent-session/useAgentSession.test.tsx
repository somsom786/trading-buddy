import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  INITIAL_AGENT_SESSION_SNAPSHOT,
  type AgentSessionSnapshot,
} from '../../domain/agent-session/types';
import type { AgentSessionService } from '../../services/tauri/agentSessionService';
import { useAgentSession } from './useAgentSession';

function readySnapshot(): AgentSessionSnapshot {
  return {
    ...INITIAL_AGENT_SESSION_SNAPSHOT,
    connectionStatus: 'ready',
    localConversationId: 'conversation-1',
  };
}

function service(snapshot = readySnapshot()): {
  fake: AgentSessionService;
  setSupportMode: ReturnType<typeof vi.fn>;
} {
  const setSupportMode = vi.fn((mode) =>
    Promise.resolve({
      ...snapshot,
      supportMode: mode,
    }),
  );
  return {
    setSupportMode,
    fake: {
      diagnostics: vi.fn().mockResolvedValue({
        status: 'ready',
        processId: 1,
        restartCount: 0,
        lastError: null,
      }),
      snapshot: vi.fn().mockResolvedValue(snapshot),
      start: vi.fn().mockResolvedValue(snapshot),
      retryConnection: vi.fn().mockResolvedValue(snapshot),
      open: vi.fn().mockResolvedValue(snapshot),
      submit: vi.fn().mockResolvedValue(snapshot),
      retry: vi.fn().mockResolvedValue(snapshot),
      setSupportMode,
      interrupt: vi.fn().mockResolvedValue(snapshot),
      close: vi.fn().mockResolvedValue(snapshot),
      purgeConversation: vi.fn().mockResolvedValue(false),
      purgeAll: vi.fn().mockResolvedValue(0),
      stop: vi.fn().mockResolvedValue(undefined),
      simulateGatewayCrash: vi.fn().mockResolvedValue(undefined),
      subscribeSnapshot: vi.fn().mockResolvedValue(() => undefined),
      subscribeStream: vi.fn().mockResolvedValue(() => undefined),
    },
  };
}

describe('useAgentSession', () => {
  it('loads the authoritative Rust snapshot and applies support-mode changes', async () => {
    const { fake, setSupportMode } = service();
    const { result } = renderHook(() => useAgentSession(fake));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.snapshot.connectionStatus).toBe('ready');

    await act(async () => {
      await result.current.setSupportMode('listen');
    });
    expect(result.current.snapshot.supportMode).toBe('listen');
    expect(setSupportMode).toHaveBeenCalledWith('listen');
  });
});
