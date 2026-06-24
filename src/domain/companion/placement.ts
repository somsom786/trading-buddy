import type { CompanionPlacementMode } from '../storage/types';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface MonitorArea {
  id: string;
  workArea: Rect;
  primary?: boolean;
}

export interface BuddyPlacementInput {
  mode: CompanionPlacementMode;
  freePosition?: Point;
  buddySize: Size;
  monitors: MonitorArea[];
  margin?: number;
}

export interface BuddyPlacementResult {
  mode: CompanionPlacementMode;
  position: Point;
  monitorId: string;
  recovered: boolean;
}

export type BubbleDirection = 'left' | 'right';

export interface BubblePlacementResult {
  position: Point;
  direction: BubbleDirection;
}

const DEFAULT_MARGIN = 16;
const DEFAULT_MONITOR: MonitorArea = {
  id: 'fallback',
  primary: true,
  workArea: { x: 0, y: 0, width: 1280, height: 720 },
};

export function resolveBuddyPlacement(input: BuddyPlacementInput): BuddyPlacementResult {
  const monitor = selectMonitor(input.monitors, input.freePosition);
  const margin = input.margin ?? DEFAULT_MARGIN;
  const mode = input.mode;
  const position = positionForMode(
    mode,
    input.freePosition,
    input.buddySize,
    monitor.workArea,
    margin,
  );
  const clamped = clampPoint(position, input.buddySize, monitor.workArea, margin);
  return {
    mode,
    position: clamped,
    monitorId: monitor.id,
    recovered: !input.freePosition || !pointInRect(input.freePosition, monitor.workArea),
  };
}

export function resolveBubblePlacement(
  buddyRect: Rect,
  bubbleSize: Size,
  workArea: Rect,
  gap = 10,
  margin = DEFAULT_MARGIN,
): BubblePlacementResult {
  const rightX = buddyRect.x + buddyRect.width + gap;
  const leftX = buddyRect.x - bubbleSize.width - gap;
  const rightSpace = workArea.x + workArea.width - rightX;
  const leftSpace = leftX - workArea.x;
  const direction: BubbleDirection =
    rightSpace >= bubbleSize.width || rightSpace >= leftSpace ? 'right' : 'left';
  const preferredX = direction === 'right' ? rightX : leftX;
  const preferredY = buddyRect.y + buddyRect.height / 2 - bubbleSize.height / 2;
  return {
    direction,
    position: clampPoint({ x: preferredX, y: preferredY }, bubbleSize, workArea, margin),
  };
}

function positionForMode(
  mode: CompanionPlacementMode,
  freePosition: Point | undefined,
  buddySize: Size,
  workArea: Rect,
  margin: number,
): Point {
  switch (mode) {
    case 'dock_left':
      return { x: workArea.x + margin, y: workArea.y + workArea.height / 2 - buddySize.height / 2 };
    case 'dock_right':
      return {
        x: workArea.x + workArea.width - buddySize.width - margin,
        y: workArea.y + workArea.height / 2 - buddySize.height / 2,
      };
    case 'taskbar_perch':
      return {
        x: workArea.x + workArea.width - buddySize.width - margin * 2,
        y: workArea.y + workArea.height - buddySize.height - margin,
      };
    case 'free':
      return (
        freePosition ?? {
          x: workArea.x + workArea.width - buddySize.width - margin * 2,
          y: workArea.y + workArea.height - buddySize.height - margin,
        }
      );
  }
}

function selectMonitor(monitors: MonitorArea[], point?: Point): MonitorArea {
  if (point) {
    const containing = monitors.find((monitor) => pointInRect(point, monitor.workArea));
    if (containing) {
      return containing;
    }
  }
  return monitors.find((monitor) => monitor.primary) ?? monitors[0] ?? DEFAULT_MONITOR;
}

function clampPoint(point: Point, size: Size, workArea: Rect, margin: number): Point {
  return {
    x: clamp(point.x, workArea.x + margin, workArea.x + workArea.width - size.width - margin),
    y: clamp(point.y, workArea.y + margin, workArea.y + workArea.height - size.height - margin),
  };
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return min;
  }
  return Math.round(Math.min(max, Math.max(min, value)));
}
