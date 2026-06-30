import { useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react';
import { BUDDY_POSE_ASSETS, type BuddyPoseAsset } from '../../assets/buddy/poseManifest';
import { selectBuddyPose, type BuddyPoseId } from '../../domain/companion/poseSelection';
import type { BuddyState } from '../../domain/companion/buddyState';
import type { BuddyVisualState } from '../../domain/companion/visualState';
import type { CreatureAnimationIntent } from '../../domain/creature/animation';
import { DEFAULT_PET_SKIN, type PetSkinSelection } from '../../domain/petdex/skins';
import { BuddyPlaceholder } from './BuddyPlaceholder';
import { PetdexBuddyRenderer } from './PetdexBuddyRenderer';

interface BuddyPoseRendererProps {
  state: BuddyState;
  visualState: BuddyVisualState;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  assets?: Partial<Record<BuddyPoseId, BuddyPoseAsset>>;
  motionEnabled?: boolean;
  reducedMotion?: boolean;
  scale?: number;
  animationIntent?: CreatureAnimationIntent;
  skin?: PetSkinSelection;
}

export function BuddyPoseRenderer({
  state,
  visualState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
  assets = BUDDY_POSE_ASSETS,
  motionEnabled = true,
  reducedMotion = false,
  scale = 1,
  animationIntent,
  skin = DEFAULT_PET_SKIN,
}: BuddyPoseRendererProps) {
  const poseId = selectBuddyPose(visualState);
  const asset = assets[poseId];
  const [failedPoseId, setFailedPoseId] = useState<BuddyPoseId | null>(null);
  const [failedSkinId, setFailedSkinId] = useState<string | null>(null);
  const hitbox = asset?.hitbox ?? { x: 0, y: 0, width: 128, height: 128 };
  const mirror = asset?.mirrorSafe && animationIntent?.facing === 'left' ? -1 : 1;
  const style = {
    '--buddy-scale': String(scale),
    '--buddy-anchor-shift-x': `${String(64 - (asset?.anchor.x ?? 64))}px`,
    '--buddy-anchor-shift-y': `${String(118 - (asset?.anchor.y ?? 118))}px`,
    '--buddy-facing-scale': String(mirror),
    clipPath: `inset(${String(hitbox.y)}px ${String(
      128 - hitbox.x - hitbox.width,
    )}px ${String(128 - hitbox.y - hitbox.height)}px ${String(hitbox.x)}px)`,
  } as CSSProperties;

  if (skin.source === 'petdex' && skin.id !== failedSkinId) {
    return (
      <PetdexBuddyRenderer
        skin={skin}
        state={state}
        visualState={visualState}
        facing={animationIntent?.facing ?? 'right'}
        reducedMotion={reducedMotion}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        {...(onPointerCancel ? { onPointerCancel } : {})}
        {...(onPointerEnter ? { onPointerEnter } : {})}
        {...(onPointerLeave ? { onPointerLeave } : {})}
        onFailure={() => {
          setFailedSkinId(skin.id);
        }}
      />
    );
  }

  if (!asset || failedPoseId === poseId) {
    return (
      <BuddyPlaceholder
        state={state}
        visualState={visualState}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        {...(onPointerCancel ? { onPointerCancel } : {})}
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
      data-facing={animationIntent?.facing ?? 'right'}
      data-animation-reason={animationIntent?.reasonCode ?? 'legacy_visual_state'}
      data-animation-loop={animationIntent?.loop ?? true}
      aria-label="Talk to Trading Buddy"
      title="Drag me or click to talk"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      {...(onPointerCancel ? { onPointerCancel } : {})}
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
