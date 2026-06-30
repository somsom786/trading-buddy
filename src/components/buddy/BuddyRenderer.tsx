import { useRef, type PointerEvent } from 'react';
import { buddyStateToVisualState, type BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';
import type { CreatureAnimationIntent } from '../../domain/creature/animation';
import type { PetSkinSelection } from '../../domain/petdex/skins';
import {
  cancelPointer,
  movePointer,
  pressPointer,
  releasePointer,
  resetPointer,
  type CreaturePointerState,
} from '../../domain/creature/pointer';
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
  animationIntent?: CreatureAnimationIntent;
  reducedMotion?: boolean;
  skin?: PetSkinSelection;
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
  animationIntent,
  reducedMotion = false,
  skin,
}: BuddyRendererProps) {
  const pointerState = useRef<CreaturePointerState>(resetPointer());

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = pressPointer(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      atMs: performance.now(),
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const result = movePointer(pointerState.current, event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      atMs: performance.now(),
    });
    pointerState.current = result.state;
    if (result.dragStarted) {
      onDragStart?.();
      void companionService.startDragging().finally(() => {
        onDragEnd?.();
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const result = releasePointer(pointerState.current, event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      atMs: performance.now(),
    });
    pointerState.current = resetPointer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (result.activate) {
      onActivate();
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    pointerState.current = cancelPointer(pointerState.current, event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerState.current = resetPointer();
  };

  return (
    <BuddyPoseRenderer
      state={state}
      visualState={visualState}
      {...(animationIntent ? { animationIntent } : {})}
      reducedMotion={reducedMotion}
      {...(skin ? { skin } : {})}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      {...(onHoverStart ? { onPointerEnter: onHoverStart } : {})}
      {...(onHoverEnd ? { onPointerLeave: onHoverEnd } : {})}
    />
  );
}
