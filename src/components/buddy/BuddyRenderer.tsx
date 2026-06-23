import { useRef, type PointerEvent } from 'react';
import type { BuddyState } from '../../domain/companion/buddyState';
import type { CompanionService } from '../../services/tauri/companionService';
import { BuddyPlaceholder } from './BuddyPlaceholder';

interface BuddyRendererProps {
  state: BuddyState;
  companionService: CompanionService;
  onActivate: () => void;
}

interface PointerStart {
  x: number;
  y: number;
  dragging: boolean;
}

export function BuddyRenderer({ state, companionService, onActivate }: BuddyRendererProps) {
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
      void companionService.startDragging();
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
    <BuddyPlaceholder
      state={state}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
