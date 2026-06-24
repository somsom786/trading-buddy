import { useState } from 'react';
import { BUDDY_POSE_ASSETS, type BuddyPoseAsset } from '../../assets/buddy/poseManifest';
import { BuddyPoseRenderer } from '../buddy/BuddyPoseRenderer';
import { BUDDY_STATES, type BuddyState } from '../../domain/companion/buddyState';
import {
  BUDDY_POSE_IDS,
  selectBuddyPose,
  type BuddyPoseId,
} from '../../domain/companion/poseSelection';
import { PROACTIVE_TEMPLATES } from '../../domain/companion/proactive';
import {
  BUDDY_ACTIVITIES,
  BUDDY_EMOTIONS,
  DEFAULT_BUDDY_VISUAL_STATE,
  visualStateLabel,
  type BuddyActivity,
  type BuddyEmotion,
} from '../../domain/companion/visualState';
import type { LocalAiStatus } from '../../domain/local-ai/types';
import type { CompanionPlacementMode } from '../../domain/storage/types';

interface BuddyLabProps {
  buddyState: BuddyState;
  activeRequestId: string | null;
  providerStatus: LocalAiStatus;
  selectedModel: string | null;
  onState: (state: BuddyState) => void;
  onWindowAction: (action: 'show' | 'hide' | 'focus') => void;
  onOpenMain: () => void;
  onMockStream: () => void;
  onMockError: () => void;
  onMockCancel: () => void;
}

const companionPlacementModes: CompanionPlacementMode[] = [
  'free',
  'dock_left',
  'dock_right',
  'taskbar_perch',
];

const ignorePointer = () => undefined;

export function BuddyLab(props: BuddyLabProps) {
  const [previewEmotion, setPreviewEmotion] = useState<BuddyEmotion>(
    DEFAULT_BUDDY_VISUAL_STATE.emotion,
  );
  const [previewActivity, setPreviewActivity] = useState<BuddyActivity>(
    DEFAULT_BUDDY_VISUAL_STATE.activity,
  );
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [forceMissingAsset, setForceMissingAsset] = useState(false);
  const previewState = {
    emotion: previewEmotion,
    activity: previewActivity,
  };
  const selectedPoseId = selectBuddyPose(previewState);
  const previewAssets = forceMissingAsset
    ? withoutPose(BUDDY_POSE_ASSETS, selectedPoseId)
    : BUDDY_POSE_ASSETS;

  return (
    <details className="buddy-lab">
      <summary>Companion Lab · development only</summary>
      <div className="buddy-lab__content">
        <figure className="buddy-concept">
          <img
            src="/design/buddy-concept-beta-v0.1.png"
            alt="Buddy BETA v0.1 pixel-art design reference with multiple poses and expressions"
          />
          <figcaption>
            Buddy design direction · BETA v0.1 concept reference, not production artwork
          </figcaption>
        </figure>

        <section className="companion-lab__preview" aria-label="Companion visual state preview">
          <BuddyPoseRenderer
            state="idle"
            visualState={previewState}
            assets={previewAssets}
            motionEnabled={motionEnabled}
            reducedMotion={reducedMotion}
            scale={previewScale}
            onPointerDown={ignorePointer}
            onPointerMove={ignorePointer}
            onPointerUp={ignorePointer}
          />
          <div>
            <p>{visualStateLabel(previewState)}</p>
            <p className="muted">Selected pose: {selectedPoseId}</p>
          </div>
        </section>

        <section>
          <h4>Pose renderer controls</h4>
          <label className="companion-lab__control">
            <input
              type="checkbox"
              checked={motionEnabled}
              onChange={(event) => {
                setMotionEnabled(event.currentTarget.checked);
              }}
            />
            Pose motion
          </label>
          <label className="companion-lab__control">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => {
                setReducedMotion(event.currentTarget.checked);
              }}
            />
            Reduced motion
          </label>
          <label className="companion-lab__control">
            Scale {previewScale.toFixed(1)}
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.1"
              value={previewScale}
              onChange={(event) => {
                setPreviewScale(Number(event.currentTarget.value));
              }}
            />
          </label>
          <label className="companion-lab__control">
            <input
              type="checkbox"
              checked={forceMissingAsset}
              onChange={(event) => {
                setForceMissingAsset(event.currentTarget.checked);
              }}
            />
            Safe missing-asset fallback fixture
          </label>
        </section>

        <section>
          <h4>Pose assets</h4>
          <div className="companion-lab__poses">
            {BUDDY_POSE_IDS.map((id) => (
              <PoseAssetPreview key={id} asset={BUDDY_POSE_ASSETS[id]} />
            ))}
          </div>
        </section>

        <section>
          <h4>Emotion</h4>
          <div className="buddy-lab__states">
            {BUDDY_EMOTIONS.map((emotion) => (
              <button
                key={emotion}
                type="button"
                aria-pressed={previewEmotion === emotion}
                onClick={() => {
                  setPreviewEmotion(emotion);
                }}
              >
                {emotion}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>Activity</h4>
          <div className="buddy-lab__states">
            {BUDDY_ACTIVITIES.map((activity) => (
              <button
                key={activity}
                type="button"
                aria-pressed={previewActivity === activity}
                onClick={() => {
                  setPreviewActivity(activity);
                }}
              >
                {activity}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>Legacy buddy command bridge</h4>
          <p className="muted">
            These buttons still drive the real desktop buddy through the existing safe state union.
          </p>
        </section>
        <div className="buddy-lab__states">
          {BUDDY_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => {
                props.onState(state);
              }}
            >
              {state}
            </button>
          ))}
        </div>
        <div className="button-row">
          {(['show', 'hide', 'focus'] as const).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                props.onWindowAction(action);
              }}
            >
              {action} buddy
            </button>
          ))}
          <button type="button" onClick={props.onOpenMain}>
            open main
          </button>
        </div>
        <div className="button-row">
          <button type="button" onClick={props.onMockStream}>
            Mock stream
          </button>
          <button type="button" onClick={props.onMockError}>
            Simulate error
          </button>
          <button type="button" onClick={props.onMockCancel}>
            Simulate cancellation
          </button>
        </div>

        <section>
          <h4>Proactive templates</h4>
          <ul className="companion-lab__list">
            {Object.entries(PROACTIVE_TEMPLATES).map(([trigger, template]) => (
              <li key={trigger}>
                <strong>{trigger}</strong>: {template}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Placement modes</h4>
          <div className="buddy-lab__states">
            {companionPlacementModes.map((mode) => (
              <button key={mode} type="button" disabled>
                {mode}
              </button>
            ))}
          </div>
          <p className="muted">
            Placement math is covered by deterministic domain tests. Native docking controls are
            still pending.
          </p>
        </section>

        <dl>
          <dt>Buddy state</dt>
          <dd>{props.buddyState}</dd>
          <dt>Visual preview</dt>
          <dd>{visualStateLabel(previewState)}</dd>
          <dt>Active request</dt>
          <dd>{props.activeRequestId ?? 'none'}</dd>
          <dt>Provider</dt>
          <dd>{props.providerStatus.status}</dd>
          <dt>Model</dt>
          <dd>{props.selectedModel ?? 'none'}</dd>
        </dl>
      </div>
    </details>
  );
}

function PoseAssetPreview({ asset }: { asset: BuddyPoseAsset }) {
  const [dimensions, setDimensions] = useState('loading');
  return (
    <figure className="companion-lab__pose">
      <img
        src={asset.src}
        alt={asset.alt}
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          setDimensions(`${String(image.naturalWidth)}×${String(image.naturalHeight)}`);
        }}
      />
      <figcaption>
        <strong>{asset.id}</strong>
        <span>{dimensions}</span>
      </figcaption>
    </figure>
  );
}

function withoutPose(
  assets: Record<BuddyPoseId, BuddyPoseAsset>,
  missingPoseId: BuddyPoseId,
): Partial<Record<BuddyPoseId, BuddyPoseAsset>> {
  return Object.fromEntries(Object.entries(assets).filter(([id]) => id !== missingPoseId));
}
