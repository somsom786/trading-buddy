import { describe, expect, it } from 'vitest';
import { sumDecimalStrings } from './decimal';
import {
  createRuntimeState,
  isSyncActive,
  normalizeActiveAccountSelection,
  syncPhaseLabel,
} from './runtime';
import type { IntegrationAccount } from './types';

const account = (id: string): IntegrationAccount => ({
  id,
  provider: 'hyperliquid',
  environment: 'testnet',
  publicAddress: '0x0000000000000000000000000000000000000000',
  normalizedAddress: '0x0000000000000000000000000000000000000000',
  displayAddress: '0x0000…0000',
  status: 'active',
  syncEnabled: true,
  createdAt: '2026-06-25T00:00:00Z',
  updatedAt: '2026-06-25T00:00:00Z',
  isFixture: true,
});

describe('trading runtime helpers', () => {
  it('normalizes active account selection deterministically', () => {
    expect(normalizeActiveAccountSelection([], 'missing')).toBeNull();
    expect(normalizeActiveAccountSelection([account('a'), account('b')], 'b')).toBe('b');
    expect(normalizeActiveAccountSelection([account('a'), account('b')], 'missing')).toBe('a');
  });

  it('labels active sync phases without fake percentages', () => {
    expect(
      syncPhaseLabel({
        accountId: 'a',
        runId: 'run',
        status: 'running',
        currentResource: 'fills',
        resourcesCompleted: ['metadata'],
        cancelRequested: false,
      }),
    ).toBe('Synchronizing fills');
    expect(
      isSyncActive({
        accountId: 'a',
        status: 'cancelling',
        resourcesCompleted: [],
        cancelRequested: true,
      }),
    ).toBe(true);
  });

  it('creates bounded runtime state with unknown freshness by default', () => {
    expect(createRuntimeState('a', '2026-06-25T00:00:00Z').freshness.status).toBe('unknown');
  });
});

describe('exact decimal helpers', () => {
  it('sums decimal strings without binary floating point rounding', () => {
    expect(sumDecimalStrings(['0.1', '0.2', '-0.05'])).toBe('0.25');
    expect(sumDecimalStrings(['-1.00000001', '0.00000001'])).toBe('-1');
    expect(sumDecimalStrings([])).toBeUndefined();
  });
});
