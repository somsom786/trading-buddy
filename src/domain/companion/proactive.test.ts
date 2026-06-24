import { describe, expect, it } from 'vitest';
import { decideProactiveCheckin, isWithinQuietHours } from './proactive';

const baseContext = {
  nowMinutes: 12 * 60,
  appSessionMinutes: 20,
  osIdleSeconds: 0,
  returnedFromIdle: false,
  generating: false,
  bubbleOpen: false,
  buddySleeping: false,
  doNotDisturb: false,
  enabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  cooldownMinutes: 180,
  minutesSinceLastCheckin: null,
  dismissedRecently: false,
};

describe('proactive check-in engine', () => {
  it('blocks check-ins during do not disturb, quiet hours, cooldown, and generation', () => {
    expect(decideProactiveCheckin({ ...baseContext, doNotDisturb: true }).reason).toBe(
      'do_not_disturb',
    );
    expect(
      decideProactiveCheckin({
        ...baseContext,
        quietHoursEnabled: true,
        nowMinutes: 23 * 60,
      }).reason,
    ).toBe('quiet_hours');
    expect(decideProactiveCheckin({ ...baseContext, minutesSinceLastCheckin: 20 }).reason).toBe(
      'cooldown',
    );
    expect(decideProactiveCheckin({ ...baseContext, generating: true }).reason).toBe('busy');
  });

  it('selects safe deterministic templates for allowed triggers', () => {
    const decision = decideProactiveCheckin({
      ...baseContext,
      returnedFromIdle: true,
      osIdleSeconds: 30 * 60,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.trigger).toBe('returned_after_idle');
    expect(decision.template).toBe('Welcome back. How are you feeling?');
    expect(decision.template).not.toMatch(/abandoned|ignoring|all you need/i);
  });

  it('detects quiet hours across midnight', () => {
    expect(isWithinQuietHours(23 * 60, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(6 * 60, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(12 * 60, '22:00', '07:00')).toBe(false);
  });
});
