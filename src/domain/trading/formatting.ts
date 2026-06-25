import type { TradingDataFreshness } from './types';

export function formatDecimal(value: string | undefined, maxDecimals = 4): string {
  if (!value) {
    return 'Unavailable';
  }
  const sign = value.startsWith('-') ? '-' : '';
  const body = sign ? value.slice(1) : value;
  const [whole = '', fraction] = body.split('.');
  if (!fraction) {
    return `${sign}${whole}`;
  }
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${sign}${whole}.${trimmed}` : `${sign}${whole}`;
}

export function freshnessLabel(freshness: TradingDataFreshness): string {
  if (freshness.status === 'unknown') {
    return 'No successful sync yet';
  }
  const minutes = Math.floor(freshness.ageSeconds / 60);
  const age = minutes < 1 ? `${String(freshness.ageSeconds)}s` : `${String(minutes)}m`;
  return `${freshness.status} · ${age} old`;
}

export function readOnlyExecutionRefusal(): string {
  return 'Trading Buddy is read-only. It cannot place, close, cancel, or modify trades. I can show your saved account facts or help you review the decision.';
}
