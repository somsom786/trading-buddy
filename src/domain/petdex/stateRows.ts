import type { BuddyState } from '../companion/buddyState';
import type { BuddyVisualState } from '../companion/visualState';

export function petdexRowForVisualState(
  state: BuddyState,
  visualState: BuddyVisualState,
  facing: 'left' | 'right',
  rowCount = 9,
): number {
  if (rowCount < 9) {
    if (state === 'error' || state === 'concerned' || visualState.activity === 'alert') {
      return 3;
    }
    if (visualState.activity === 'writing' || state === 'thinking') {
      return 4;
    }
    if (state === 'talking' || state === 'happy' || visualState.activity === 'talking') {
      return 1;
    }
    if (visualState.activity === 'looking') {
      return 2;
    }
    return 0;
  }
  if (state === 'error' || state === 'concerned' || visualState.activity === 'alert') {
    return 5;
  }
  if (visualState.activity === 'writing') {
    return 8;
  }
  if (
    state === 'thinking' ||
    state === 'listening' ||
    state === 'sleeping' ||
    visualState.activity === 'thinking' ||
    visualState.activity === 'listening'
  ) {
    return 6;
  }
  if (state === 'talking' || state === 'happy' || visualState.activity === 'talking') {
    return 3;
  }
  if (visualState.activity === 'looking') {
    return facing === 'left' ? 2 : 1;
  }
  return 0;
}
