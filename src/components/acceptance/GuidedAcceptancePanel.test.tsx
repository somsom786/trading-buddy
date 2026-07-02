import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAcceptanceRun } from '../../domain/acceptance/runner';
import type { AcceptanceDiagnostics } from '../../domain/acceptance/types';
import type { AcceptanceService } from '../../services/tauri/acceptanceService';
import { GuidedAcceptancePanel } from './GuidedAcceptancePanel';

const diagnostics: AcceptanceDiagnostics = {
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
      bounds: { x: 10, y: 10, width: 128, height: 128 },
    },
  ],
  monitors: [
    {
      id: 'monitor-0',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      primary: true,
    },
  ],
  buddyRect: { x: 10, y: 10, width: 128, height: 128 },
  bubbleRect: null,
  activeLocalConversationId: null,
  redactedSessionId: null,
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

describe('GuidedAcceptancePanel', () => {
  it('records a human result with automatic diagnostics and resumes at the next step', async () => {
    const user = userEvent.setup();
    const saveRun = vi.fn();
    const service: AcceptanceService = {
      captureDiagnostics: vi.fn().mockResolvedValue(diagnostics),
      loadRun: vi.fn(() => createAcceptanceRun(new Date('2026-07-02T10:00:00Z'))),
      saveRun,
      resetRun: vi.fn(() => createAcceptanceRun()),
    };
    render(<GuidedAcceptancePanel service={service} />);

    await user.click(screen.getByText('Task 12D · Guided Native Acceptance (development only)'));
    await user.type(screen.getByLabelText('Sanitized note'), 'Observed one buddy.');
    await user.click(screen.getByRole('button', { name: 'Passed' }));

    expect(await screen.findByText(/Step 2 of 25/)).toBeInTheDocument();
    expect(saveRun).toHaveBeenCalledOnce();
    const firstCall = saveRun.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const saved = firstCall?.[0];
    expect(saved).toBeDefined();
    if (!saved) {
      throw new Error('Expected a persisted acceptance run.');
    }
    expect(saved.results[0]).toMatchObject({
      status: 'passed',
      evidence: 'human_observed',
      note: 'Observed one buddy.',
      diagnostics,
    });
  });
});
