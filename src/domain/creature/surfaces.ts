import type { DesktopWorldSnapshot, SurfaceRect } from '../desktop-world/types';
import type { CreatureSafeArea, CreatureSurface } from './types';

const WINDOW_SURFACE_TTL_MS = 2_500;
const FLOOR_SURFACE_TTL_MS = 30_000;
const MIN_WINDOW_SURFACE_WIDTH = 48;

export function buildSafeAreas(snapshot: DesktopWorldSnapshot): CreatureSafeArea[] {
  const primaryByMonitor = new Map(
    snapshot.monitors.map((monitor) => [monitor.id, monitor.primary]),
  );
  return snapshot.workAreas.map((workArea) => ({
    monitorId: workArea.monitorId,
    bounds: workArea.bounds,
    primary: primaryByMonitor.get(workArea.monitorId) ?? false,
  }));
}

export function buildSurfaceGraph(
  snapshot: DesktopWorldSnapshot,
  capturedAtMs = snapshot.capturedAtMs,
  options: { includeWindowSurfaces?: boolean } = {},
): CreatureSurface[] {
  const safeAreas = buildSafeAreas(snapshot);
  const surfaces = safeAreas.map((area) => floorSurface(area, capturedAtMs));

  if (options.includeWindowSurfaces === false) {
    return surfaces;
  }

  for (const rect of snapshot.visibleWindowRects) {
    if (rect.width < MIN_WINDOW_SURFACE_WIDTH) {
      continue;
    }
    const area = safeAreas.find((candidate) => intersects(candidate.bounds, rect));
    if (!area || rect.y <= area.bounds.y || rect.y >= area.bounds.y + area.bounds.height) {
      continue;
    }
    if (
      rect.width >= area.bounds.width * 0.95 &&
      rect.height >= area.bounds.height * 0.9 &&
      rect.y <= area.bounds.y + 8
    ) {
      continue;
    }
    const left = Math.max(rect.x, area.bounds.x);
    const right = Math.min(rect.x + rect.width, area.bounds.x + area.bounds.width);
    if (right - left < MIN_WINDOW_SURFACE_WIDTH) {
      continue;
    }
    surfaces.push({
      id: `window_top:${area.monitorId}:${String(left)}:${String(rect.y)}:${String(right - left)}`,
      kind: 'window_top',
      start: { x: left, y: rect.y },
      end: { x: right, y: rect.y },
      normal: { x: 0, y: -1 },
      monitorId: area.monitorId,
      validUntilMs: capturedAtMs + WINDOW_SURFACE_TTL_MS,
    });
  }

  return surfaces.sort((left, right) => {
    if (left.start.y !== right.start.y) {
      return left.start.y - right.start.y;
    }
    return left.start.x - right.start.x;
  });
}

export interface SurfaceFollowResult {
  kind: 'unchanged' | 'followed' | 'detached';
  surfaceId: string | null;
  position: { x: number; y: number };
}

export function reconcileMovingWindowSurface(input: {
  previousSurface: CreatureSurface;
  nextSurfaces: CreatureSurface[];
  position: { x: number; y: number };
  buddyWidth: number;
  buddyHeight: number;
  edgeMargin: number;
  maxCorrection?: number;
  hysteresis?: number;
}): SurfaceFollowResult {
  const maxCorrection = input.maxCorrection ?? 48;
  const hysteresis = input.hysteresis ?? 1.5;
  if (input.previousSurface.kind !== 'window_top') {
    return {
      kind: 'unchanged',
      surfaceId: input.previousSurface.id,
      position: input.position,
    };
  }
  const previousWidth = input.previousSurface.end.x - input.previousSurface.start.x;
  const candidates = input.nextSurfaces
    .filter(
      (surface) =>
        surface.kind === 'window_top' && surface.monitorId === input.previousSurface.monitorId,
    )
    .map((surface) => {
      const width = surface.end.x - surface.start.x;
      const dx = surface.start.x - input.previousSurface.start.x;
      const dy = surface.start.y - input.previousSurface.start.y;
      const widthDelta = width - previousWidth;
      return {
        surface,
        dx,
        dy,
        widthDelta,
        score: Math.abs(dx) + Math.abs(dy) * 2 + Math.abs(widthDelta) * 0.25,
      };
    })
    .filter(
      ({ dx, dy, widthDelta }) =>
        Math.abs(dx) <= maxCorrection &&
        Math.abs(dy) <= maxCorrection &&
        Math.abs(widthDelta) <= maxCorrection * 3,
    )
    .sort(
      (left, right) => left.score - right.score || left.surface.id.localeCompare(right.surface.id),
    );
  const match = candidates[0];
  if (!match) {
    return { kind: 'detached', surfaceId: null, position: input.position };
  }
  if (
    Math.abs(match.dx) < hysteresis &&
    Math.abs(match.dy) < hysteresis &&
    Math.abs(match.widthDelta) < hysteresis
  ) {
    return {
      kind: 'unchanged',
      surfaceId: match.surface.id,
      position: input.position,
    };
  }
  const offset = input.position.x - input.previousSurface.start.x;
  const minX = match.surface.start.x + input.edgeMargin;
  const maxX = match.surface.end.x - input.buddyWidth - input.edgeMargin;
  return {
    kind: 'followed',
    surfaceId: match.surface.id,
    position: {
      x: clamp(match.surface.start.x + offset, minX, Math.max(minX, maxX)),
      y: match.surface.start.y - input.buddyHeight,
    },
  };
}

export function activeSurfaces(surfaces: CreatureSurface[], nowMs: number): CreatureSurface[] {
  return surfaces.filter((surface) => surface.validUntilMs >= nowMs);
}

function floorSurface(area: CreatureSafeArea, capturedAtMs: number): CreatureSurface {
  return {
    id: `monitor_floor:${area.monitorId}`,
    kind: 'monitor_floor',
    start: {
      x: area.bounds.x,
      y: area.bounds.y + area.bounds.height,
    },
    end: {
      x: area.bounds.x + area.bounds.width,
      y: area.bounds.y + area.bounds.height,
    },
    normal: { x: 0, y: -1 },
    monitorId: area.monitorId,
    validUntilMs: capturedAtMs + FLOOR_SURFACE_TTL_MS,
  };
}

function intersects(left: SurfaceRect, right: SurfaceRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
