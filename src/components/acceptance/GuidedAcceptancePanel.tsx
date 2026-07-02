import { useMemo, useState } from 'react';
import {
  ACCEPTANCE_STEPS,
  serializeAcceptanceMarkdown,
  updateAcceptanceResult,
} from '../../domain/acceptance/runner';
import type {
  AcceptanceDiagnostics,
  AcceptanceEvidence,
  AcceptanceRun,
  AcceptanceStatus,
} from '../../domain/acceptance/types';
import {
  tauriAcceptanceService,
  type AcceptanceService,
} from '../../services/tauri/acceptanceService';

interface GuidedAcceptancePanelProps {
  service?: AcceptanceService;
}

const statusOptions: { value: AcceptanceStatus; label: string }[] = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'not_available', label: 'Not available on this hardware' },
];

export function GuidedAcceptancePanel({
  service = tauriAcceptanceService,
}: GuidedAcceptancePanelProps) {
  const [run, setRun] = useState<AcceptanceRun>(() => service.loadRun());
  const [note, setNote] = useState(() => run.results[run.currentStepIndex]?.note ?? '');
  const [evidence, setEvidence] = useState<AcceptanceEvidence>('human_observed');
  const [diagnostics, setDiagnostics] = useState<AcceptanceDiagnostics | null>(
    run.results[run.currentStepIndex]?.diagnostics ?? null,
  );
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const step = requiredStep(run.currentStepIndex);
  const result = requiredResult(run, run.currentStepIndex);
  const completed = useMemo(
    () => run.results.filter((item) => item.status !== 'not_tested').length,
    [run.results],
  );

  const selectStep = (index: number) => {
    const next = requiredResult(run, index);
    setRun({ ...run, currentStepIndex: index });
    setNote(next.note);
    setEvidence(next.evidence === 'not_tested' ? 'human_observed' : next.evidence);
    setDiagnostics(next.diagnostics);
    setDiagnosticError(null);
  };

  const capture = async (): Promise<AcceptanceDiagnostics | null> => {
    setCapturing(true);
    setDiagnosticError(null);
    try {
      const next = await service.captureDiagnostics();
      setDiagnostics(next);
      return next;
    } catch {
      setDiagnosticError(
        'Safe diagnostics were unavailable. The observation can still be recorded.',
      );
      return null;
    } finally {
      setCapturing(false);
    }
  };

  const mark = async (status: AcceptanceStatus) => {
    const automatic = (await capture()) ?? diagnostics;
    const next = updateAcceptanceResult(run, run.currentStepIndex, {
      status,
      evidence,
      note,
      diagnostics: automatic,
    });
    service.saveRun(next);
    setRun(next);
    const nextResult = requiredResult(next, next.currentStepIndex);
    setNote(nextResult.note);
    const nextEvidence = nextResult.evidence;
    setEvidence(nextEvidence === 'not_tested' ? 'human_observed' : nextEvidence);
    setDiagnostics(nextResult.diagnostics);
  };

  return (
    <details className="diagnostic-panel acceptance-panel">
      <summary>Task 12D · Guided Native Acceptance (development only)</summary>
      <header className="acceptance-panel__header">
        <div>
          <p className="eyebrow">Human QA recorder</p>
          <h2>
            Step {run.currentStepIndex + 1} of {ACCEPTANCE_STEPS.length}: {step.title}
          </h2>
        </div>
        <strong>
          {completed}/{ACCEPTANCE_STEPS.length} recorded
        </strong>
      </header>

      <p>{step.instruction}</p>
      <p className="acceptance-panel__expected">
        <strong>Expected:</strong> {step.expected}
      </p>
      <p className="muted">
        Automated diagnostics supplement this record; they never replace direct human observation.
      </p>

      <label>
        Evidence class
        <select
          value={evidence}
          onChange={(event) => {
            setEvidence(event.currentTarget.value as AcceptanceEvidence);
          }}
        >
          <option value="human_observed">Human-observed</option>
          <option value="automatically_measured">Automatically measured</option>
          <option value="fixture_only">Fixture-only</option>
        </select>
      </label>
      <label>
        Sanitized note
        <textarea
          rows={3}
          maxLength={500}
          value={note}
          placeholder="Brief behavior, failure, blocker, or hardware limitation. Never paste secrets or conversation text."
          onChange={(event) => {
            setNote(event.currentTarget.value);
          }}
        />
      </label>

      <div className="acceptance-panel__status-grid">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === 'failed' ? 'stop-button' : 'secondary-button'}
            onClick={() => void mark(option.value)}
            disabled={capturing}
          >
            {option.label}
          </button>
        ))}
      </div>

      <details className="acceptance-panel__diagnostics">
        <summary>Safe automatic diagnostics</summary>
        <button type="button" className="text-button" onClick={() => void capture()}>
          {capturing ? 'Capturing…' : 'Refresh diagnostics'}
        </button>
        {diagnosticError ? <p role="alert">{diagnosticError}</p> : null}
        {diagnostics ? <DiagnosticsSummary diagnostics={diagnostics} /> : <p>Not captured yet.</p>}
      </details>

      <footer className="acceptance-panel__footer">
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            disabled={run.currentStepIndex === 0}
            onClick={() => {
              selectStep(run.currentStepIndex - 1);
            }}
          >
            Previous
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={run.currentStepIndex === ACCEPTANCE_STEPS.length - 1}
            onClick={() => {
              selectStep(run.currentStepIndex + 1);
            }}
          >
            Next
          </button>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              exportJson(run);
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              exportMarkdown(run);
            }}
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (window.confirm('Reset this unfinished acceptance walkthrough?')) {
                const next = service.resetRun();
                setRun(next);
                selectStepState(next, 0, setNote, setEvidence, setDiagnostics);
              }
            }}
          >
            Reset walkthrough
          </button>
        </div>
      </footer>
      <p className="muted">
        Current recorded status: {result.status.replaceAll('_', ' ')} · Run {run.runId}
      </p>
    </details>
  );
}

function DiagnosticsSummary({ diagnostics }: { diagnostics: AcceptanceDiagnostics }) {
  return (
    <dl>
      <dt>Processes</dt>
      <dd>
        App {diagnostics.appProcessCount} · Gateway {diagnostics.gatewayProcessCount}
      </dd>
      <dt>Gateway / provider</dt>
      <dd>
        {diagnostics.gatewayStatus} · {diagnostics.providerStatus} · {diagnostics.providerModel}
      </dd>
      <dt>Windows</dt>
      <dd>
        {diagnostics.windowStates
          .map((window) => `${window.label}:${window.visible ? 'visible' : 'hidden'}`)
          .join(' · ')}
      </dd>
      <dt>Monitors</dt>
      <dd>
        {diagnostics.monitors
          .map(
            (monitor) =>
              `${monitor.id}:${String(monitor.scaleFactor)}x${monitor.primary ? ':primary' : ''}`,
          )
          .join(' · ')}
      </dd>
      <dt>Conversation / session</dt>
      <dd>
        {diagnostics.activeLocalConversationId ?? 'none'} ·{' '}
        {diagnostics.redactedSessionId ?? 'none'}
      </dd>
      <dt>Request / turn</dt>
      <dd>
        {diagnostics.activeRequestId ?? 'none'} · {diagnostics.activeTurnId ?? 'none'}
      </dd>
      <dt>Stream</dt>
      <dd>
        {diagnostics.turnStatus} · sequence {diagnostics.lastSequenceNumber}
      </dd>
      <dt>Reconnect / duplicate / stale</dt>
      <dd>
        {diagnostics.reconnectCount} / {diagnostics.duplicateEventCount} /{' '}
        {diagnostics.staleEventCount}
      </dd>
      <dt>Orphan audit</dt>
      <dd>{diagnostics.orphanProcessResult.replaceAll('_', ' ')}</dd>
    </dl>
  );
}

function selectStepState(
  run: AcceptanceRun,
  index: number,
  setNote: (value: string) => void,
  setEvidence: (value: AcceptanceEvidence) => void,
  setDiagnostics: (value: AcceptanceDiagnostics | null) => void,
) {
  const result = requiredResult(run, index);
  setNote(result.note);
  setEvidence(result.evidence === 'not_tested' ? 'human_observed' : result.evidence);
  setDiagnostics(result.diagnostics);
}

function requiredStep(index: number) {
  const step = ACCEPTANCE_STEPS[index];
  if (!step) {
    throw new Error(`Acceptance step ${String(index)} is unavailable.`);
  }
  return step;
}

function requiredResult(run: AcceptanceRun, index: number) {
  const result = run.results[index];
  if (!result) {
    throw new Error(`Acceptance result ${String(index)} is unavailable.`);
  }
  return result;
}

function exportJson(run: AcceptanceRun) {
  download(`trading-buddy-native-acceptance-${run.runId}.json`, JSON.stringify(run, null, 2));
}

function exportMarkdown(run: AcceptanceRun) {
  download(`trading-buddy-native-acceptance-${run.runId}.md`, serializeAcceptanceMarkdown(run));
}

function download(fileName: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
