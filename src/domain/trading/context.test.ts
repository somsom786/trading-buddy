import { describe, expect, it } from 'vitest';
import { buildTradingContext, type TradingFacts } from './context';

const facts: TradingFacts = {
  summary: {
    account: {
      id: 'acct_1',
      provider: 'hyperliquid',
      environment: 'testnet',
      publicAddress: '0xabcdefabcdef1234567890000000000000000000',
      normalizedAddress: '0xabcdefabcdef1234567890000000000000000000',
      displayAddress: '0xabcd…0000',
      displayName: 'Fixture main',
      status: 'active',
      syncEnabled: true,
      createdAt: '2026-06-25T00:00:00Z',
      updatedAt: '2026-06-25T00:00:00Z',
      lastSuccessfulDataAt: '2026-06-25T00:00:00Z',
      isFixture: true,
      fixtureScenario: 'single_long',
    },
    accountValue: '1000.500000',
    totalMarginUsed: '10.25',
    openPositionCount: 1,
    fillCount: 1,
    fundingCount: 1,
    openOrderCount: 1,
    freshness: { status: 'fresh', ageSeconds: 120 },
    partialSync: false,
    readOnly: true,
  },
  sync: {
    accountId: 'acct_1',
    status: 'idle',
    resourcesCompleted: [],
    cancelRequested: false,
  },
  positions: [
    {
      id: 'position_internal',
      symbol: 'ETH',
      side: 'long',
      signedSize: '1.25',
      absoluteSize: '1.25',
      entryPrice: '3412.50',
      markPrice: '3438.10',
      notional: '4297.625',
      leverageValue: '3',
      unrealizedPnl: '32.00',
      snapshotTimestamp: '2026-06-25T00:00:00Z',
    },
  ],
  fills: [
    {
      id: 'fill_internal',
      symbol: 'ETH',
      side: 'buy',
      direction: 'Open Long',
      price: '3412.50',
      size: '1.25',
      fee: '1.20',
      fillTimestamp: '2026-06-25T00:00:00Z',
    },
  ],
  funding: [
    {
      id: 'funding_internal',
      symbol: 'ETH',
      amount: '-0.10',
      fundingRate: '0.00001',
      eventTimestamp: '2026-06-25T00:00:00Z',
    },
  ],
  orders: [
    {
      id: 'order_internal',
      sourceOrderId: 'oid',
      symbol: 'ETH',
      side: 'sell',
      price: '4000',
      size: '1.25',
      reduceOnly: true,
    },
  ],
};

describe('bounded trading context builder', () => {
  it('labels read-only fixture facts and excludes full addresses/internal ids', () => {
    const context = buildTradingContext(
      {
        accountId: 'acct_1',
        intent: 'show_positions',
        maximumCharacters: 4000,
        maximumPositions: 5,
        maximumFills: 5,
        maximumFundingRecords: 5,
        maximumOrders: 5,
      },
      facts,
    );

    expect(context).toContain('READ-ONLY HYPERLIQUID ACCOUNT FACTS');
    expect(context).toContain('Fixture data [fixture]');
    expect(context).toContain('Execution capability: None');
    expect(context).toContain('Size: 1.25 [exchange-reported]');
    expect(context).toContain('Withdrawable: Unavailable [exchange-reported]');
    expect(context).not.toContain('0xabcdefabcdef1234567890000000000000000000');
    expect(context).not.toContain('position_internal');
  });

  it('enforces the character budget deterministically', () => {
    const context = buildTradingContext(
      {
        accountId: 'acct_1',
        intent: 'show_positions',
        maximumCharacters: 180,
        maximumPositions: 5,
        maximumFills: 5,
        maximumFundingRecords: 5,
        maximumOrders: 5,
      },
      facts,
    );
    expect(context).toHaveLength(180);
    expect(context).toContain('[truncated deterministically]');
  });

  it('includes exact saved funding totals for funding intents', () => {
    const context = buildTradingContext(
      {
        accountId: 'acct_1',
        intent: 'show_funding',
        maximumCharacters: 4000,
        maximumPositions: 5,
        maximumFills: 5,
        maximumFundingRecords: 5,
        maximumOrders: 5,
      },
      {
        ...facts,
        funding: [
          ...facts.funding,
          {
            id: 'funding_internal_2',
            symbol: 'BTC',
            amount: '0.2',
            fundingRate: '0.00002',
            eventTimestamp: '2026-06-25T00:00:00Z',
          },
        ],
      },
    );

    expect(context).toContain('Synchronized total: 0.1 [locally summed]');
    expect(context).not.toContain('funding_internal_2');
  });

  it('returns null when no account summary is available', () => {
    expect(
      buildTradingContext(
        {
          accountId: 'missing',
          intent: 'show_account',
          maximumCharacters: 1000,
          maximumPositions: 5,
          maximumFills: 5,
          maximumFundingRecords: 5,
          maximumOrders: 5,
        },
        { ...facts, summary: null },
      ),
    ).toBeNull();
  });
});
