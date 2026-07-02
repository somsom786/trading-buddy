export type AcceptanceStatus = 'not_tested' | 'passed' | 'failed' | 'blocked' | 'not_available';

export type AcceptanceEvidence =
  | 'human_observed'
  | 'automatically_measured'
  | 'fixture_only'
  | 'not_tested';

export interface AcceptanceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AcceptanceWindowState {
  label: 'buddy' | 'bubble' | 'main';
  visible: boolean;
  focused: boolean;
  bounds: AcceptanceRect;
}

export interface AcceptanceMonitorState {
  id: string;
  bounds: AcceptanceRect;
  workArea: AcceptanceRect;
  scaleFactor: number;
  primary: boolean;
}

export interface AcceptanceDiagnostics {
  capturedAtMs: number;
  appProcessCount: number;
  gatewayProcessCount: number;
  gatewayStatus: string;
  gatewayRestartCount: number;
  windowStates: AcceptanceWindowState[];
  monitors: AcceptanceMonitorState[];
  buddyRect: AcceptanceRect;
  bubbleRect: AcceptanceRect | null;
  activeLocalConversationId: string | null;
  redactedSessionId: string | null;
  activeRequestId: string | null;
  activeTurnId: string | null;
  turnStatus: string;
  lastSequenceNumber: number;
  reconnectCount: number;
  duplicateEventCount: number;
  staleEventCount: number;
  providerStatus: string;
  providerModel: string;
  orphanProcessResult: string;
}

export interface AcceptanceStepDefinition {
  id: string;
  title: string;
  instruction: string;
  expected: string;
}

export interface AcceptanceStepResult {
  stepId: string;
  status: AcceptanceStatus;
  evidence: AcceptanceEvidence;
  note: string;
  updatedAt: string | null;
  diagnostics: AcceptanceDiagnostics | null;
}

export interface AcceptanceRun {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  updatedAt: string;
  currentStepIndex: number;
  results: AcceptanceStepResult[];
}

export function isAcceptanceDiagnostics(value: unknown): value is AcceptanceDiagnostics {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isSafeNonNegativeInteger(value.capturedAtMs) &&
    isSafeNonNegativeInteger(value.appProcessCount) &&
    isSafeNonNegativeInteger(value.gatewayProcessCount) &&
    typeof value.gatewayStatus === 'string' &&
    isSafeNonNegativeInteger(value.gatewayRestartCount) &&
    Array.isArray(value.windowStates) &&
    value.windowStates.every(isWindowState) &&
    Array.isArray(value.monitors) &&
    value.monitors.every(isMonitorState) &&
    isRect(value.buddyRect) &&
    (value.bubbleRect === null || isRect(value.bubbleRect)) &&
    isNullableBoundedString(value.activeLocalConversationId, 128) &&
    isNullableBoundedString(value.redactedSessionId, 16) &&
    isNullableBoundedString(value.activeRequestId, 128) &&
    isNullableBoundedString(value.activeTurnId, 128) &&
    isBoundedString(value.turnStatus, 32) &&
    isSafeNonNegativeInteger(value.lastSequenceNumber) &&
    isSafeNonNegativeInteger(value.reconnectCount) &&
    isSafeNonNegativeInteger(value.duplicateEventCount) &&
    isSafeNonNegativeInteger(value.staleEventCount) &&
    isBoundedString(value.providerStatus, 32) &&
    isBoundedString(value.providerModel, 128) &&
    isBoundedString(value.orphanProcessResult, 80)
  );
}

function isWindowState(value: unknown): value is AcceptanceWindowState {
  return (
    isRecord(value) &&
    ['buddy', 'bubble', 'main'].includes(String(value.label)) &&
    typeof value.visible === 'boolean' &&
    typeof value.focused === 'boolean' &&
    isRect(value.bounds)
  );
}

function isMonitorState(value: unknown): value is AcceptanceMonitorState {
  return (
    isRecord(value) &&
    isBoundedString(value.id, 80) &&
    isRect(value.bounds) &&
    isRect(value.workArea) &&
    typeof value.scaleFactor === 'number' &&
    Number.isFinite(value.scaleFactor) &&
    value.scaleFactor > 0 &&
    value.scaleFactor <= 8 &&
    typeof value.primary === 'boolean'
  );
}

function isRect(value: unknown): value is AcceptanceRect {
  return (
    isRecord(value) &&
    ['x', 'y', 'width', 'height'].every(
      (key) => typeof value[key] === 'number' && Number.isSafeInteger(value[key]),
    ) &&
    (value.width as number) >= 0 &&
    (value.height as number) >= 0
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableBoundedString(value: unknown, maximum: number): value is string | null {
  return value === null || isBoundedString(value, maximum);
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
