import type {
  AcceptanceDiagnostics,
  AcceptanceEvidence,
  AcceptanceRun,
  AcceptanceStatus,
  AcceptanceStepDefinition,
} from './types';
import { isAcceptanceDiagnostics } from './types';

export const ACCEPTANCE_STEPS: readonly AcceptanceStepDefinition[] = [
  {
    id: '01-launch',
    title: 'Launch the native desktop app',
    instruction: 'Start with corepack pnpm desktop:dev.',
    expected: 'One Trading Buddy app and one logical private gateway become ready.',
  },
  {
    id: '02-processes',
    title: 'Confirm process ownership',
    instruction: 'Inspect the safe process counters after startup.',
    expected: 'One app instance and at most one owned gateway are reported.',
  },
  {
    id: '03-startup-windows',
    title: 'Confirm companion-first startup',
    instruction: 'Observe the desktop immediately after launch.',
    expected: 'Exactly one buddy is visible and Companion Home remains hidden.',
  },
  {
    id: '04-placement-skin',
    title: 'Confirm placement and restored skin',
    instruction: 'Check the buddy location and selected appearance.',
    expected: 'Buddy is inside a work area and the prior valid skin is restored.',
  },
  {
    id: '05-drag-release',
    title: 'Drag and release Buddy',
    instruction: 'Move beyond the drag threshold, then release.',
    expected: 'Native drag begins once, autonomous motion pauses, and no ghost appears.',
  },
  {
    id: '06-fall-land-recover',
    title: 'Observe physical recovery',
    instruction: 'Watch the complete release sequence.',
    expected: 'Buddy drops, falls, lands, recovers, and settles stably.',
  },
  {
    id: '07-bring-back',
    title: 'Use Bring Buddy Back',
    instruction: 'Invoke Bring Buddy Back from the tray.',
    expected: 'Buddy returns inside the primary work area and stays visible.',
  },
  {
    id: '08-open-bubble',
    title: 'Open the attached Bubble',
    instruction: 'Single-click Buddy with only slight pointer movement.',
    expected: 'The compact Bubble opens attached, inside the work area, with focused input.',
  },
  {
    id: '09-keyboard',
    title: 'Verify Enter and Shift+Enter',
    instruction: 'Create a newline with Shift+Enter, then send with Enter.',
    expected: 'Shift+Enter does not send; Enter sends once; empty input never sends.',
  },
  {
    id: '10-listen-mode',
    title: 'Select Listen',
    instruction: 'Choose Listen before the acceptance prompt.',
    expected: 'Listen remains selected and is sent as separate support metadata.',
  },
  {
    id: '11-listen-prompt',
    title: 'Send the Listen prompt',
    instruction: 'Send: “I lost money today. Just listen.”',
    expected: 'The clean user text appears exactly once with one assistant placeholder.',
  },
  {
    id: '12-lifecycle',
    title: 'Observe lifecycle feedback',
    instruction: 'Watch Buddy from submit through completion.',
    expected: 'Listening is immediate, then thinking, talking, and calm—without fake progress.',
  },
  {
    id: '13-bubble-stream',
    title: 'Observe live Bubble text',
    instruction: 'Watch the assistant response in the Bubble.',
    expected: 'Real visible deltas stream and scrolling follows unless the user scrolls away.',
  },
  {
    id: '14-open-home-during-stream',
    title: 'Open Home during generation',
    instruction: 'Open Companion Home while the same response is active.',
    expected: 'The same conversation and assistant attempt appear; no second request starts.',
  },
  {
    id: '15-shared-stream',
    title: 'Confirm identical shared stream',
    instruction: 'Observe Bubble and Home together.',
    expected: 'Both surfaces continue the same ordered stream with one assistant message.',
  },
  {
    id: '16-stop-bubble',
    title: 'Stop from Bubble',
    instruction: 'Stop the active request in the Bubble.',
    expected: 'Home updates to the same cancelled terminal state exactly once.',
  },
  {
    id: '17-retry',
    title: 'Retry without duplication',
    instruction: 'Retry the cancelled attempt.',
    expected: 'The user message remains once and a new assistant attempt/request ID is created.',
  },
  {
    id: '18-copy',
    title: 'Copy explicitly',
    instruction: 'Use Copy on a visible assistant response.',
    expected: 'Copy occurs only after the explicit button action.',
  },
  {
    id: '19-reopen',
    title: 'Close and reopen Bubble',
    instruction: 'Close with Escape, then click Buddy again.',
    expected: 'Recent transcript, selected support mode, and stable placement restore.',
  },
  {
    id: '20-restart',
    title: 'Restart and restore conversation',
    instruction: 'Quit and relaunch the application.',
    expected: 'Persistent transcript restores; no duplicate turn or buddy appears.',
  },
  {
    id: '21-provider-recovery',
    title: 'Verify provider failure and recovery',
    instruction:
      'Use a safe development failure simulation or temporarily remove the private NVIDIA credential, then restore it.',
    expected: 'Buddy stays alive, failure is honest, no fake response appears, and retry succeeds.',
  },
  {
    id: '22-gateway-recovery',
    title: 'Verify gateway recovery',
    instruction:
      'Use Crash backend safely in the development Agent Session Lab during a bounded test turn.',
    expected: 'No blind resubmit occurs; ambiguous work becomes recoverable; restart is bounded.',
  },
  {
    id: '23-monitor-dpi',
    title: 'Test monitor and DPI behavior',
    instruction: 'Use a secondary, negative-coordinate, or non-100%-scale monitor if available.',
    expected: 'Buddy/Bubble remain visible, attached, and recoverable after display changes.',
  },
  {
    id: '24-temporary-delete',
    title: 'Verify temporary and deletion privacy',
    instruction: 'Exercise Temporary reset/restart and delete a safe persistent fixture.',
    expected: 'Temporary content stays non-durable; deleted transcript/mapping do not return.',
  },
  {
    id: '25-tray-quit',
    title: 'Verify tray and clean shutdown',
    instruction: 'Exercise tray actions, then Quit and perform the external owned-process audit.',
    expected: 'Tray actions work and no Trading Buddy or owned gateway process remains.',
  },
] as const;

const NOTE_LIMIT = 500;

export function createAcceptanceRun(now = new Date()): AcceptanceRun {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    runId: `native-${timestamp.replaceAll(/[:.]/g, '-')}`,
    startedAt: timestamp,
    updatedAt: timestamp,
    currentStepIndex: 0,
    results: ACCEPTANCE_STEPS.map((step) => ({
      stepId: step.id,
      status: 'not_tested',
      evidence: 'not_tested',
      note: '',
      updatedAt: null,
      diagnostics: null,
    })),
  };
}

export function updateAcceptanceResult(
  run: AcceptanceRun,
  stepIndex: number,
  update: {
    status: AcceptanceStatus;
    evidence: AcceptanceEvidence;
    note: string;
    diagnostics: AcceptanceDiagnostics | null;
  },
  now = new Date(),
): AcceptanceRun {
  if (stepIndex < 0 || stepIndex >= ACCEPTANCE_STEPS.length) {
    return run;
  }
  const timestamp = now.toISOString();
  const results = run.results.map((result, index) =>
    index === stepIndex
      ? {
          ...result,
          status: update.status,
          evidence: update.status === 'not_tested' ? 'not_tested' : update.evidence,
          note: sanitizeAcceptanceNote(update.note),
          updatedAt: timestamp,
          diagnostics: update.diagnostics,
        }
      : result,
  );
  return {
    ...run,
    updatedAt: timestamp,
    currentStepIndex: nextPendingIndex(results, stepIndex),
    results,
  };
}

export function sanitizeAcceptanceNote(value: string): string {
  const withoutControlCharacters = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
      ? ' '
      : character;
  }).join('');
  return withoutControlCharacters
    .replace(/nvapi-[A-Za-z0-9_-]+/gi, '[redacted-api-key]')
    .replace(/bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/(?:sk|pk)-[A-Za-z0-9_-]{12,}/g, '[redacted-secret]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NOTE_LIMIT);
}

export function serializeAcceptanceMarkdown(run: AcceptanceRun): string {
  const rows = ACCEPTANCE_STEPS.map((step, index) => {
    const result = run.results[index];
    if (!result) {
      return '';
    }
    return [
      `## ${String(index + 1)}. ${step.title}`,
      '',
      `- Status: **${statusLabel(result.status)}**`,
      `- Evidence: **${evidenceLabel(result.evidence)}**`,
      `- Expected: ${step.expected}`,
      `- Note: ${result.note || 'None'}`,
      `- Updated: ${result.updatedAt ?? 'Not tested'}`,
      result.diagnostics ? `- Automatic diagnostics: ${diagnosticSummary(result.diagnostics)}` : '',
      '',
    ]
      .filter(Boolean)
      .join('\n');
  });
  return [
    '# Trading Buddy native acceptance result',
    '',
    `- Run ID: ${run.runId}`,
    `- Started: ${run.startedAt}`,
    `- Updated: ${run.updatedAt}`,
    '- Evidence policy: human observation, automatic measurement, fixture evidence, and untested',
    '  states are intentionally distinct.',
    '',
    ...rows,
  ].join('\n');
}

export function isAcceptanceRun(value: unknown): value is AcceptanceRun {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const run = value as Partial<AcceptanceRun>;
  return (
    run.schemaVersion === 1 &&
    typeof run.runId === 'string' &&
    run.runId.length <= 100 &&
    typeof run.startedAt === 'string' &&
    typeof run.updatedAt === 'string' &&
    Number.isSafeInteger(run.currentStepIndex) &&
    (run.currentStepIndex ?? -1) >= 0 &&
    (run.currentStepIndex ?? ACCEPTANCE_STEPS.length) < ACCEPTANCE_STEPS.length &&
    Array.isArray(run.results) &&
    run.results.length === ACCEPTANCE_STEPS.length &&
    run.results.every((result, index) => {
      const expectedStep = ACCEPTANCE_STEPS[index];
      return (
        result.stepId === expectedStep?.id &&
        ['not_tested', 'passed', 'failed', 'blocked', 'not_available'].includes(result.status) &&
        ['human_observed', 'automatically_measured', 'fixture_only', 'not_tested'].includes(
          result.evidence,
        ) &&
        typeof result.note === 'string' &&
        result.note.length <= NOTE_LIMIT &&
        (result.updatedAt === null || typeof result.updatedAt === 'string') &&
        (result.diagnostics === null || isAcceptanceDiagnostics(result.diagnostics))
      );
    })
  );
}

function nextPendingIndex(results: AcceptanceRun['results'], current: number): number {
  const later = results.findIndex(
    (result, index) => index > current && result.status === 'not_tested',
  );
  if (later >= 0) {
    return later;
  }
  const any = results.findIndex((result) => result.status === 'not_tested');
  return any >= 0 ? any : Math.min(current + 1, results.length - 1);
}

function statusLabel(status: AcceptanceStatus): string {
  return status.replaceAll('_', ' ').toUpperCase();
}

function evidenceLabel(evidence: AcceptanceEvidence): string {
  return evidence.replaceAll('_', ' ');
}

function diagnosticSummary(diagnostics: AcceptanceDiagnostics): string {
  return [
    `app=${String(diagnostics.appProcessCount)}`,
    `appSetupMs=${String(diagnostics.applicationSetupMs)}`,
    `gateway=${diagnostics.gatewayStatus}/${String(diagnostics.gatewayProcessCount)}`,
    `gatewayReadyMs=${timingValue(diagnostics.gatewayReadyMs)}`,
    `windows=${diagnostics.windowStates
      .map((window) => `${window.label}:${window.visible ? 'visible' : 'hidden'}`)
      .join(',')}`,
    `monitors=${String(diagnostics.monitors.length)}`,
    `turn=${diagnostics.turnStatus}`,
    `sequence=${String(diagnostics.lastSequenceNumber)}`,
    `duplicate=${String(diagnostics.duplicateEventCount)}`,
    `stale=${String(diagnostics.staleEventCount)}`,
    `provider=${diagnostics.providerStatus}`,
    `conversations=${String(diagnostics.conversationCount)}`,
    `messages=${String(diagnostics.messageCount)}`,
    `mappings=${String(diagnostics.agentSessionLinkCount)}`,
    `acceptedMs=${timingValue(diagnostics.latency.promptAcceptedAtMs)}`,
    `firstVisibleMs=${timingValue(diagnostics.latency.firstVisibleContentAtMs)}`,
    `totalMs=${timingValue(diagnostics.latency.totalTurnMs)}`,
  ].join('; ');
}

function timingValue(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}
