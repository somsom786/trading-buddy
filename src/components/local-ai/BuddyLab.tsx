import { useState } from 'react';
import { BuddyPlaceholder } from '../buddy/BuddyPlaceholder';
import { BUDDY_STATES, type BuddyState } from '../../domain/companion/buddyState';
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
  const previewState = {
    emotion: previewEmotion,
    activity: previewActivity,
  };

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
          <BuddyPlaceholder
            state="idle"
            visualState={previewState}
            onPointerDown={ignorePointer}
            onPointerMove={ignorePointer}
            onPointerUp={ignorePointer}
          />
          <p>{visualStateLabel(previewState)}</p>
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
