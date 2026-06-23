import type { PointerEvent } from 'react';
import type { BuddyState } from '../../domain/companion/buddyState';

interface BuddyPlaceholderProps {
  state: BuddyState;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
}

export function BuddyPlaceholder({
  state,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BuddyPlaceholderProps) {
  return (
    <button
      type="button"
      className="buddy-character"
      data-state={state}
      aria-label="Open Trading Buddy"
      title="Drag me or click to open Trading Buddy"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
