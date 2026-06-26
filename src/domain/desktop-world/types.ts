export interface DesktopPoint {
  x: number;
  y: number;
}

export interface SurfaceRect extends DesktopPoint {
  width: number;
  height: number;
}

export interface MonitorSurface {
  id: string;
  bounds: SurfaceRect;
  scaleFactor: number;
  primary: boolean;
}

export interface WorkArea {
  monitorId: string;
  bounds: SurfaceRect;
}

export type SurfaceSupport = 'windows_geometry' | 'monitor_only_fallback';

export interface DesktopWorldSnapshot {
  monitors: MonitorSurface[];
  workAreas: WorkArea[];
  visibleWindowRects: SurfaceRect[];
  buddyRect: SurfaceRect;
  bubbleRect: SurfaceRect | null;
  cursorPosition: DesktopPoint | null;
  capturedAtMs: number;
  surfaceSupport: SurfaceSupport;
}

export function isDesktopWorldSnapshot(value: unknown): value is DesktopWorldSnapshot {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !Array.isArray(value.monitors) ||
    !value.monitors.every(isMonitorSurface) ||
    !Array.isArray(value.workAreas) ||
    !value.workAreas.every(isWorkArea) ||
    !Array.isArray(value.visibleWindowRects) ||
    !value.visibleWindowRects.every(isSurfaceRect)
  ) {
    return false;
  }
  return (
    isSurfaceRect(value.buddyRect) &&
    (value.bubbleRect === null || isSurfaceRect(value.bubbleRect)) &&
    (value.cursorPosition === null || isDesktopPoint(value.cursorPosition)) &&
    isFiniteNumber(value.capturedAtMs) &&
    value.capturedAtMs >= 0 &&
    (value.surfaceSupport === 'windows_geometry' ||
      value.surfaceSupport === 'monitor_only_fallback')
  );
}

function isMonitorSurface(value: unknown): value is MonitorSurface {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    isSurfaceRect(value.bounds) &&
    isFiniteNumber(value.scaleFactor) &&
    value.scaleFactor > 0 &&
    typeof value.primary === 'boolean'
  );
}

function isWorkArea(value: unknown): value is WorkArea {
  return (
    isRecord(value) &&
    typeof value.monitorId === 'string' &&
    value.monitorId.length > 0 &&
    isSurfaceRect(value.bounds)
  );
}

function isSurfaceRect(value: unknown): value is SurfaceRect {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    isFiniteNumber(value.height) &&
    value.height > 0
  );
}

export function isDesktopPoint(value: unknown): value is DesktopPoint {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
