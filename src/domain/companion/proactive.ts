export type ProactiveTrigger =
  | 'returned_after_idle'
  | 'long_session'
  | 'evening_checkin'
  | 'quiet_presence';

export interface ProactiveContext {
  nowMinutes: number;
  appSessionMinutes: number;
  osIdleSeconds: number;
  returnedFromIdle: boolean;
  generating: boolean;
  bubbleOpen: boolean;
  buddySleeping: boolean;
  doNotDisturb: boolean;
  enabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  cooldownMinutes: number;
  minutesSinceLastCheckin: number | null;
  dismissedRecently: boolean;
}

export interface ProactiveDecision {
  allowed: boolean;
  trigger?: ProactiveTrigger;
  template?: string;
  reason?:
    | 'disabled'
    | 'do_not_disturb'
    | 'quiet_hours'
    | 'cooldown'
    | 'dismissed'
    | 'busy'
    | 'sleeping'
    | 'bubble_open'
    | 'no_trigger';
}

export const PROACTIVE_TEMPLATES: Record<ProactiveTrigger, string> = {
  returned_after_idle: 'Welcome back. How are you feeling?',
  long_session: 'You’ve been here for a while. Want to take a short break?',
  evening_checkin: 'Before the day ends, is there anything you want to get off your mind?',
  quiet_presence: 'Quiet day? I’m here if you want to talk.',
};

export function decideProactiveCheckin(context: ProactiveContext): ProactiveDecision {
  if (!context.enabled) {
    return { allowed: false, reason: 'disabled' };
  }
  if (context.doNotDisturb) {
    return { allowed: false, reason: 'do_not_disturb' };
  }
  if (
    context.quietHoursEnabled &&
    isWithinQuietHours(context.nowMinutes, context.quietHoursStart, context.quietHoursEnd)
  ) {
    return { allowed: false, reason: 'quiet_hours' };
  }
  if (
    context.minutesSinceLastCheckin !== null &&
    context.minutesSinceLastCheckin < context.cooldownMinutes
  ) {
    return { allowed: false, reason: 'cooldown' };
  }
  if (context.dismissedRecently) {
    return { allowed: false, reason: 'dismissed' };
  }
  if (context.generating) {
    return { allowed: false, reason: 'busy' };
  }
  if (context.buddySleeping) {
    return { allowed: false, reason: 'sleeping' };
  }
  if (context.bubbleOpen) {
    return { allowed: false, reason: 'bubble_open' };
  }

  const trigger = selectTrigger(context);
  if (!trigger) {
    return { allowed: false, reason: 'no_trigger' };
  }
  return {
    allowed: true,
    trigger,
    template: PROACTIVE_TEMPLATES[trigger],
  };
}

export function isWithinQuietHours(nowMinutes: number, start: string, end: string): boolean {
  const startMinutes = parseClockMinutes(start);
  const endMinutes = parseClockMinutes(end);
  if (startMinutes === endMinutes) {
    return false;
  }
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function selectTrigger(context: ProactiveContext): ProactiveTrigger | null {
  if (context.returnedFromIdle && context.osIdleSeconds >= 20 * 60) {
    return 'returned_after_idle';
  }
  if (context.appSessionMinutes >= 120) {
    return 'long_session';
  }
  if (context.nowMinutes >= 18 * 60 && context.nowMinutes <= 21 * 60) {
    return 'evening_checkin';
  }
  if (
    context.minutesSinceLastCheckin === null ||
    context.minutesSinceLastCheckin >= context.cooldownMinutes * 2
  ) {
    return 'quiet_presence';
  }
  return null;
}

function parseClockMinutes(value: string): number {
  const parts = value.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (
    typeof hours !== 'number' ||
    typeof minutes !== 'number' ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return 0;
  }
  return hours * 60 + minutes;
}
