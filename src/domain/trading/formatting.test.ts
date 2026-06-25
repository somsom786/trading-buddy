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
    expect(detectTradingIntent('Open a long.')).toBe('unsupported_trade_execution');
    expect(detectTradingIntent('Cancel my orders.')).toBe('unsupported_trade_execution');
    expect(detectTradingIntent('Move my stop.')).toBe('unsupported_trade_execution');
    expect(detectTradingIntent('Open Trading.')).toBe('open_trading_home');
    expect(detectTradingIntent('Stop the refresh.')).toBe('cancel_hyperliquid_sync');
    expect(detectTradingIntent('Show my Hyperliquid account.')).toBe('show_account');
    expect(detectTradingIntent('What positions do I have?')).toBe('show_positions');
    expect(detectTradingIntent('I am in a weird position emotionally.')).toBe('not_trading_intent');
    expect(detectTradingIntent('how are you buddy?')).toBe('not_trading_intent');
    expect(readOnlyExecutionRefusal()).toContain('cannot place, close, cancel, or modify trades');
  });
});
