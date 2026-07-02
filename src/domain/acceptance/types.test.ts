import { describe, expect, it } from 'vitest';
import { isAcceptanceDiagnostics } from './types';

const validDiagnostics = {
  capturedAtMs: 1,
  applicationSetupMs: 82,
  appProcessCount: 1,
  gatewayProcessCount: 1,
  gatewayStatus: 'ready',
  gatewayRestartCount: 0,
  gatewaySpawnMs: 45,
  gatewayReadyMs: 307,
  windowStates: [
    {
      label: 'buddy',
      visible: true,
      focused: false,
      bounds: { x: 10, y: 20, width: 128, height: 128 },
    },
  ],
  monitors: [
    {
      id: 'monitor-0',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1.25,
      primary: true,
    },
  ],
  buddyRect: { x: 10, y: 20, width: 128, height: 128 },
  bubbleRect: null,
  activeLocalConversationId: null,
  redactedSessionId: '...123456',
  activeRequestId: null,
  activeTurnId: null,
  turnStatus: 'idle',
  lastSequenceNumber: 0,
  reconnectCount: 0,
  duplicateEventCount: 0,
  staleEventCount: 0,
  providerStatus: 'ready',
  providerModel: 'deepseek-ai/deepseek-v4-pro',
  orphanProcessResult: 'not_measurable_while_application_is_running',
  latency: {
    clientContextRetrievalMs: null,
    clientContextBudgetMs: null,
    clientPromptConstructionMs: null,
    rustTurnPreparationMs: null,
    sessionOpenMs: null,
    promptDispatchMs: null,
    promptAcceptedAtMs: null,
    firstProviderEventAtMs: null,
    providerRequestStartedAtMs: null,
    firstVisibleContentAtMs: null,
    completionReceivedAtMs: null,
    sqliteFinalizationMs: null,
    crossWindowBroadcastMicros: null,
    frontendRenderMs: null,
    totalTurnMs: null,
  },
};

describe('acceptance diagnostics boundary', () => {
  it('accepts only bounded geometry and allowlisted window labels', () => {
    expect(isAcceptanceDiagnostics(validDiagnostics)).toBe(true);
    expect(
      isAcceptanceDiagnostics({
        ...validDiagnostics,
        windowStates: [{ ...validDiagnostics.windowStates[0], label: 'unrelated-window' }],
      }),
    ).toBe(false);
  });

  it('rejects invalid scale factors and oversized identifiers', () => {
    expect(
      isAcceptanceDiagnostics({
        ...validDiagnostics,
        monitors: [{ ...validDiagnostics.monitors[0], scaleFactor: Number.NaN }],
      }),
    ).toBe(false);
    expect(
      isAcceptanceDiagnostics({
        ...validDiagnostics,
        activeRequestId: 'x'.repeat(129),
      }),
    ).toBe(false);
  });
});
