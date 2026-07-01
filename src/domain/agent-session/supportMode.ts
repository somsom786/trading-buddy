import type { CompanionSupportMode } from './types';

export const COMPANION_SUPPORT_MODES: readonly CompanionSupportMode[] = [
  'listen',
  'reflect',
  'plan',
  'hang_out',
  'presence',
];

export function isCompanionSupportMode(value: unknown): value is CompanionSupportMode {
  return (
    typeof value === 'string' && COMPANION_SUPPORT_MODES.includes(value as CompanionSupportMode)
  );
}

export function supportModeLabel(mode: CompanionSupportMode): string {
  switch (mode) {
    case 'listen':
      return 'Listen';
    case 'reflect':
      return 'Reflect';
    case 'plan':
      return 'Plan';
    case 'hang_out':
      return 'Hang out';
    case 'presence':
      return 'Presence';
  }
}
