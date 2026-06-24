import type { BuddyActivity, BuddyEmotion, BuddyVisualState } from './visualState';

export interface AmbientLifeConfig {
  enabled: boolean;
  reducedMotion: boolean;
  sleepAfterInactivitySeconds: number;
  nowMs: number;
  lastUserInteractionMs: number;
  rng: () => number;
}

export type AmbientPriority =
  | 'alert'
  | 'direct_interaction'
  | 'active_conversation'
  | 'proactive_checkin'
  | 'sleep_transition'
  | 'ambient';

export interface AmbientContext {
  priority: AmbientPriority;
  current: BuddyVisualState;
  osIdleSeconds: number;
}

export interface AmbientDecision {
  state: BuddyVisualState;
  nextDelayMs: number;
  reason: 'disabled' | 'paused' | 'sleep' | 'blink' | 'look' | 'stretch' | 'sit' | 'breathe';
}

const MIN_DELAY_MS = 2_500;
const MAX_DELAY_MS = 14_000;

export function decideAmbientLife(
  context: AmbientContext,
  config: AmbientLifeConfig,
): AmbientDecision {
  if (!config.enabled || config.reducedMotion) {
    return {
      state: { emotion: 'calm', activity: 'idle' },
      nextDelayMs: MAX_DELAY_MS,
      reason: 'disabled',
    };
  }
  if (context.priority !== 'ambient' && context.priority !== 'sleep_transition') {
    return {
      state: context.current,
      nextDelayMs: boundedDelay(config.rng),
      reason: 'paused',
    };
  }
  const inactiveSeconds = Math.max(
    context.osIdleSeconds,
    Math.floor((config.nowMs - config.lastUserInteractionMs) / 1_000),
  );
  if (inactiveSeconds >= config.sleepAfterInactivitySeconds) {
    return {
      state: { emotion: 'sleepy', activity: 'sleeping' },
      nextDelayMs: MAX_DELAY_MS,
      reason: 'sleep',
    };
  }

  const roll = config.rng();
  if (roll < 0.34) {
    return ambient('calm', 'blinking', config.rng, 'blink');
  }
  if (roll < 0.58) {
    return ambient('curious', 'looking', config.rng, 'look');
  }
  if (roll < 0.72) {
    return ambient('calm', 'stretching', config.rng, 'stretch');
  }
  if (roll < 0.84) {
    return ambient('sleepy', 'sitting', config.rng, 'sit');
  }
  return ambient('calm', 'breathing', config.rng, 'breathe');
}

export function wakeVisualState(): BuddyVisualState {
  return { emotion: 'curious', activity: 'waking' };
}

export function conversationVisualState(
  phase: 'listening' | 'thinking' | 'talking' | 'error' | 'done',
): BuddyVisualState {
  switch (phase) {
    case 'listening':
      return { emotion: 'curious', activity: 'listening' };
    case 'thinking':
      return { emotion: 'calm', activity: 'thinking' };
    case 'talking':
      return { emotion: 'happy', activity: 'talking' };
    case 'error':
      return { emotion: 'concerned', activity: 'alert' };
    case 'done':
      return { emotion: 'calm', activity: 'breathing' };
  }
}

function ambient(
  emotion: BuddyEmotion,
  activity: BuddyActivity,
  rng: () => number,
  reason: AmbientDecision['reason'],
): AmbientDecision {
  return {
    state: { emotion, activity },
    nextDelayMs: boundedDelay(rng),
    reason,
  };
}

function boundedDelay(rng: () => number): number {
  const normalized = Math.max(0, Math.min(0.999, rng()));
  return Math.round(MIN_DELAY_MS + normalized * (MAX_DELAY_MS - MIN_DELAY_MS));
}
