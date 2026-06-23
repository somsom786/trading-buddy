import { BUDDY_STATES, type BuddyState } from '../../domain/companion/buddyState';
import type { LocalAiStatus } from '../../domain/local-ai/types';

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

export function BuddyLab(props: BuddyLabProps) {
  return (
    <details className="buddy-lab">
      <summary>Buddy Lab · development only</summary>
      <div className="buddy-lab__content">
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
        <dl>
          <dt>Buddy state</dt>
          <dd>{props.buddyState}</dd>
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
