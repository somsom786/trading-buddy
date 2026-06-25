import { describe, expect, it } from 'vitest';
import { detectTradingIntent } from './intents';
import { formatDecimal, freshnessLabel, readOnlyExecutionRefusal } from './formatting';

describe('trading frontend domain helpers', () => {
  it('formats exact decimal strings for display without inventing unavailable values', () => {
    expect(formatDecimal(undefined)).toBe('Unavailable');
    expect(formatDecimal('1000.500000')).toBe('1000.5');
    expect(formatDecimal('-0.020000')).toBe('-0.02');
    expect(formatDecimal('0.00000001', 8)).toBe('0.00000001');
  });

  it('labels freshness without claiming live exchange values', () => {
    expect(freshnessLabel({ status: 'unknown' })).toBe('No successful sync yet');
    expect(freshnessLabel({ status: 'stale', ageSeconds: 3700 })).toBe('stale · 61m old');
  });

  it('detects read-only execution requests deterministically', () => {
    expect(detectTradingIntent('Close my ETH position')).toBe('unsupported_trade_execution');
    expect(readOnlyExecutionRefusal()).toContain('read-only');
  });
});
