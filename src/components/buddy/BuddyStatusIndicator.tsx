import type { BuddyState } from '../../domain/companion/buddyState';

export function BuddyStatusIndicator({ state }: { state: BuddyState }) {
  return (
    <span className="buddy-status" aria-live="polite">
      {state}
    </span>
  );
}
