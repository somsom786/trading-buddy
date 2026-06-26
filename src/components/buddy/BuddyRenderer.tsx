import { useRef, type PointerEvent } from 'react';
import { buddyStateToVisualState, type BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';
import type { CompanionService } from '../../services/tauri/companionService';
import { BuddyPoseRenderer } from './BuddyPoseRenderer';

interface BuddyRendererProps {
  state: BuddyState;
  visualState?: BuddyVisualState;
  companionService: CompanionService;
  onActivate: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

interface PointerStart {
  x: number;
  y: number;
  dragging: boolean;
}

export function BuddyRenderer({
  state,
  visualState = buddyStateToVisualState(state),
  companionService,
  onActivate,
  onDragStart,
  onDragEnd,
  onHoverStart,
  onHoverEnd,
}: BuddyRendererProps) {
  const pointerStart = useRef<PointerStart | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { x: event.clientX, y: event.clientY, dragging: false };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current;
    if (!start || start.dragging) {
      return;
    }
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance >= 6) {
      start.dragging = true;
      onDragStart?.();
      void companionService.startDragging().finally(() => {
        onDragEnd?.();
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (start && !start.dragging) {
      onActivate();
    }
  };

  return (
    <BuddyPoseRenderer
      state={state}
      visualState={visualState}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      {...(onHoverStart ? { onPointerEnter: onHoverStart } : {})}
      {...(onHoverEnd ? { onPointerLeave: onHoverEnd } : {})}
    />
  );
}
