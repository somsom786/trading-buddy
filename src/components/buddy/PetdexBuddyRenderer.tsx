import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react';
import type { BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';
import type { PetSkinSelection } from '../../domain/petdex/skins';
import { petdexRowForVisualState } from '../../domain/petdex/stateRows';

interface PetdexBuddyRendererProps {
  skin: PetSkinSelection;
  state: BuddyState;
  visualState: BuddyVisualState;
  facing: 'left' | 'right';
  reducedMotion: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFailure: () => void;
}

const FRAMES_PER_STATE = 6;
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;

export function PetdexBuddyRenderer({
  skin,
  state,
  visualState,
  facing,
  reducedMotion,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
  onFailure,
}: PetdexBuddyRendererProps) {
  const [frame, setFrame] = useState(0);
  const [grid, setGrid] = useState({ columns: 8, rows: 9 });
  const row = petdexRowForVisualState(state, visualState, facing, grid.rows);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % Math.min(FRAMES_PER_STATE, grid.columns));
    }, 145);
    return () => {
      window.clearInterval(timer);
    };
  }, [grid.columns, reducedMotion, row, skin.id]);

  const style = {
    '--petdex-frame-x': `${String((frame / Math.max(1, grid.columns - 1)) * 100)}%`,
    '--petdex-frame-y': `${String((row / Math.max(1, grid.rows - 1)) * 100)}%`,
    '--petdex-background-width': `${String(grid.columns * 100)}%`,
    '--petdex-background-height': `${String(grid.rows * 100)}%`,
    '--petdex-sheet': `url("${skin.spritesheetUrl ?? ''}")`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="buddy-character buddy-character--petdex"
      data-state={state}
      data-activity={visualState.activity}
      aria-label="Talk to Trading Buddy"
      title={`Drag ${skin.displayName} or click to talk`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      {...(onPointerCancel ? { onPointerCancel } : {})}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className="buddy-character__petdex-frame" aria-hidden="true" />
      <img
        className="buddy-character__petdex-preload"
        src={skin.spritesheetUrl}
        alt=""
        onLoad={(event) => {
          const columns = event.currentTarget.naturalWidth / FRAME_WIDTH;
          const rows = event.currentTarget.naturalHeight / FRAME_HEIGHT;
          if (
            Number.isInteger(columns) &&
            Number.isInteger(rows) &&
            ((columns === 8 && rows === 9) || (columns === 9 && rows === 8))
          ) {
            setGrid({ columns, rows });
          } else {
            onFailure();
          }
        }}
        onError={onFailure}
      />
      {state === 'sleeping' ? (
        <span className="buddy-character__sleep-indicator" aria-hidden="true">
          z
        </span>
      ) : null}
    </button>
  );
}
