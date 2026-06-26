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
): CreatureSurface[] {
  const safeAreas = buildSafeAreas(snapshot);
  const surfaces = safeAreas.map((area) => floorSurface(area, capturedAtMs));

  for (const rect of snapshot.visibleWindowRects) {
    if (rect.width < MIN_WINDOW_SURFACE_WIDTH) {
      continue;
    }
    const area = safeAreas.find((candidate) => intersects(candidate.bounds, rect));
    if (!area || rect.y <= area.bounds.y || rect.y >= area.bounds.y + area.bounds.height) {
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
