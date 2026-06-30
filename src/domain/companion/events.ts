import { isBuddyState, type BuddyState } from './buddyState';
import {
  isCreatureMovementPreferences,
  type CreatureMovementPreferences,
} from '../creature/preferences';
import {
  isCreatureLabAction,
  isCreatureRuntimeDiagnostics,
  type CreatureLabAction,
  type CreatureRuntimeDiagnostics,
} from '../creature/diagnostics';
import { isPetSkinSelection, type PetSkinSelection } from '../petdex/skins';

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
  | { type: 'do_not_disturb' }
  | { type: 'bring_buddy_back' }
  | { type: 'set_skin'; skin: PetSkinSelection }
  | { type: 'movement_preferences_changed'; preferences: CreatureMovementPreferences }
  | { type: 'creature_lab_action'; action: CreatureLabAction };

export type CompanionInteraction =
  | { type: 'buddy_clicked' }
  | { type: 'open_main_requested' }
  | { type: 'interaction_detected' }
  | { type: 'creature_diagnostics'; diagnostics: CreatureRuntimeDiagnostics };

export function isCompanionCommand(value: unknown): value is CompanionCommand {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  if (value.type === 'set_state') {
    return isBuddyState(value.state);
  }
  if (value.type === 'movement_preferences_changed') {
    return isCreatureMovementPreferences(value.preferences);
  }
  if (value.type === 'creature_lab_action') {
    return isCreatureLabAction(value.action);
  }
  if (value.type === 'set_skin') {
    return isPetSkinSelection(value.skin);
  }
  return [
    'wake',
    'focus',
    'show',
    'hide',
    'toggle_bubble',
    'do_not_disturb',
    'bring_buddy_back',
  ].includes(value.type);
}

export function isCompanionInteraction(value: unknown): value is CompanionInteraction {
  if (isRecord(value) && value.type === 'creature_diagnostics') {
    return isCreatureRuntimeDiagnostics(value.diagnostics);
  }
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    ['buddy_clicked', 'open_main_requested', 'interaction_detected'].includes(value.type)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
