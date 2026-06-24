import { isBuddyState, type BuddyState } from './buddyState';

export const COMPANION_EVENT_NAMES = {
  command: 'trading-buddy://companion-command',
  interaction: 'trading-buddy://companion-interaction',
} as const;

export type CompanionCommand =
  | { type: 'set_state'; state: BuddyState }
  | { type: 'wake' }
  | { type: 'focus' }
  | { type: 'show' }
  | { type: 'hide' }
  | { type: 'toggle_bubble' }
  | { type: 'do_not_disturb' };

export type CompanionInteraction =
  | { type: 'buddy_clicked' }
  | { type: 'open_main_requested' }
  | { type: 'interaction_detected' };

export function isCompanionCommand(value: unknown): value is CompanionCommand {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  return value.type === 'set_state'
    ? isBuddyState(value.state)
    : ['wake', 'focus', 'show', 'hide', 'toggle_bubble', 'do_not_disturb'].includes(value.type);
}

export function isCompanionInteraction(value: unknown): value is CompanionInteraction {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    ['buddy_clicked', 'open_main_requested', 'interaction_detected'].includes(value.type)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
