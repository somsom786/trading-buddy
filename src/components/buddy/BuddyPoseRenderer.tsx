import { useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react';
import { BUDDY_POSE_ASSETS, type BuddyPoseAsset } from '../../assets/buddy/poseManifest';
import { selectBuddyPose, type BuddyPoseId } from '../../domain/companion/poseSelection';
import type { BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';
import { BuddyPlaceholder } from './BuddyPlaceholder';

interface BuddyPoseRendererProps {
  state: BuddyState;
  visualState: BuddyVisualState;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  assets?: Partial<Record<BuddyPoseId, BuddyPoseAsset>>;
  motionEnabled?: boolean;
  reducedMotion?: boolean;
  scale?: number;
}

export function BuddyPoseRenderer({
  state,
  visualState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  assets = BUDDY_POSE_ASSETS,
  motionEnabled = true,
  reducedMotion = false,
  scale = 1,
}: BuddyPoseRendererProps) {
  const poseId = selectBuddyPose(visualState);
  const asset = assets[poseId];
  const [failedPoseId, setFailedPoseId] = useState<BuddyPoseId | null>(null);
  const style = { '--buddy-scale': String(scale) } as CSSProperties;

  if (!asset || failedPoseId === poseId) {
    return (
      <BuddyPlaceholder
        state={state}
        visualState={visualState}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        {...(onPointerEnter ? { onPointerEnter } : {})}
        {...(onPointerLeave ? { onPointerLeave } : {})}
      />
    );
  }

  const handleDragStart = (event: DragEvent<HTMLImageElement>) => {
    event.preventDefault();
  };

  return (
    <button
      type="button"
      className="buddy-character buddy-character--pose"
      data-state={state}
      data-emotion={visualState.emotion}
      data-activity={visualState.activity}
      data-pose={poseId}
      data-motion={motionEnabled && !reducedMotion ? 'on' : 'off'}
      aria-label="Talk to Trading Buddy"
      title="Drag me or click to talk"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <img
        className="buddy-character__pose"
        src={asset.src}
        alt={asset.alt}
        draggable={false}
        onDragStart={handleDragStart}
        onError={() => {
          if (import.meta.env.DEV) {
            console.warn(`Buddy pose failed to load: ${poseId}`);
          }
          setFailedPoseId(poseId);
        }}
      />
      <span className="buddy-character__core-effect" aria-hidden="true" />
      {poseId === 'sleeping' ? (
        <span className="buddy-character__sleep-indicator" aria-hidden="true">
          z
        </span>
      ) : null}
    </button>
  );
}
