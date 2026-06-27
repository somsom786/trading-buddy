import type { PointerEvent } from 'react';
import type { BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';

interface BuddyPlaceholderProps {
  state: BuddyState;
  visualState: BuddyVisualState;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export function BuddyPlaceholder({
  state,
  visualState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
}: BuddyPlaceholderProps) {
  return (
    <button
      type="button"
      className="buddy-character"
      data-state={state}
      data-emotion={visualState.emotion}
      data-activity={visualState.activity}
      aria-label="Talk to Trading Buddy"
      title="Drag me or click to talk"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className="buddy-character__antennae" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="buddy-character__body" aria-hidden="true">
        <span className="buddy-character__face">
          <span className="buddy-character__eye buddy-character__eye--left" />
          <span className="buddy-character__eye buddy-character__eye--right" />
          <span className="buddy-character__mouth" />
        </span>
        <span className="buddy-character__core" />
      </span>
    </button>
  );
}
