import { freshnessLabel, formatDecimal } from './formatting';
import { sumDecimalStrings } from './decimal';
import type {
  HyperliquidAccountSummary,
  HyperliquidFill,
  HyperliquidFunding,
  HyperliquidOpenOrder,
  HyperliquidPosition,
  HyperliquidSyncProgress,
} from './types';
import type { TradingIntent } from './intents';
import { syncPhaseLabel } from './runtime';

export interface TradingContextRequest {
  accountId: string;
  intent: TradingIntent;
  maximumCharacters: number;
  maximumPositions: number;
  maximumFills: number;
  maximumFundingRecords: number;
  maximumOrders: number;
}

export interface TradingFacts {
  summary: HyperliquidAccountSummary | null;
  sync: HyperliquidSyncProgress | null;
  positions: HyperliquidPosition[];
  fills: HyperliquidFill[];
  funding: HyperliquidFunding[];
  orders: HyperliquidOpenOrder[];
}

export function buildTradingContext(
  request: TradingContextRequest,
  facts: TradingFacts,
): string | null {
  if (!facts.summary) {
    return null;
  }
  const account = facts.summary.account;
  const sections: string[] = [
    'READ-ONLY HYPERLIQUID ACCOUNT FACTS',
    `Account: ${safeLine(account.displayName ?? account.displayAddress)} [saved]`,
    `Environment: ${account.environment} [saved]`,
    `Account kind: ${account.isFixture ? 'Fixture data [fixture]' : 'Live public address [saved]'}`,
    `Address: ${account.displayAddress} [saved]`,
    `Data freshness: ${freshnessLabel(facts.summary.freshness)} [saved]`,
    `Sync status: ${syncPhaseLabel(facts.sync)} [saved]`,
    `Partial state: ${facts.summary.partialSync ? 'yes [saved]' : 'no [saved]'}`,
    'Execution capability: None. Trading Buddy cannot place, close, cancel, or modify trades.',
    '',
    'ACCOUNT VALUES',
    labelled('Account value', facts.summary.accountValue, 'exchange-reported'),
    labelled('Margin used', facts.summary.totalMarginUsed, 'exchange-reported'),
    labelled('Withdrawable', facts.summary.withdrawable, 'exchange-reported'),
    `Open positions: ${String(facts.summary.openPositionCount)} [locally counted]`,
    `Stored fills: ${String(facts.summary.fillCount)} [locally counted]`,
    `Stored funding records: ${String(facts.summary.fundingCount)} [locally counted]`,
    `Open orders: ${String(facts.summary.openOrderCount)} [locally counted]`,
  ];

  if (request.intent === 'show_positions' || request.intent === 'show_account') {
    sections.push('', ...positionSections(facts.positions.slice(0, request.maximumPositions)));
  }
  if (request.intent === 'show_recent_fills') {
    sections.push('', ...fillSections(facts.fills.slice(0, request.maximumFills)));
  }
  if (request.intent === 'show_funding') {
    sections.push('', ...fundingSections(facts.funding.slice(0, request.maximumFundingRecords)));
  }
  if (request.intent === 'show_open_orders') {
    sections.push('', ...orderSections(facts.orders.slice(0, request.maximumOrders)));
  }

  sections.push(
    '',
    'RULES',
    'Use only the supplied account facts.',
    'Treat missing values as unavailable.',
    'Do not invent prices, balances, PnL, leverage, or order state.',
    'Do not calculate authoritative financial results.',
    'Do not recommend buying, selling, leverage, or position changes.',
    'Do not predict market movement.',
    'Mention stale, saved, fixture, or partial data when relevant.',
  );

  return enforceBudget(sections.join('\n'), request.maximumCharacters);
}

function positionSections(positions: HyperliquidPosition[]): string[] {
  if (positions.length === 0) {
    return ['POSITIONS', 'No saved open positions. [locally counted]'];
  }
  return [
    'POSITIONS',
    ...positions.flatMap((position, index) => [
      `Position ${String(index + 1)}`,
      `Asset: ${safeLine(position.symbol)} [saved]`,
      `Side: ${safeLine(position.side)} [exchange-reported]`,
      labelled('Size', position.absoluteSize, 'exchange-reported'),
      labelled('Entry', position.entryPrice, 'exchange-reported'),
      labelled('Mark', position.markPrice, 'exchange-reported'),
      labelled('Notional', position.notional, 'exchange-reported'),
      labelled('Leverage', position.leverageValue, 'exchange-reported'),
      labelled('Liquidation', position.liquidationPrice, 'exchange-reported'),
      labelled('Unrealized PnL', position.unrealizedPnl, 'exchange-reported'),
    ]),
  ];
}

function fillSections(fills: HyperliquidFill[]): string[] {
  if (fills.length === 0) {
    return ['RECENT FILLS', 'No saved fills. [locally counted]'];
  }
  return [
    'RECENT FILLS',
    ...fills.flatMap((fill, index) => [
      `Fill ${String(index + 1)}`,
      `Timestamp: ${safeLine(fill.fillTimestamp)} [saved]`,
      `Asset: ${safeLine(fill.symbol)} [saved]`,
      `Side: ${safeLine(fill.side)} [exchange-reported]`,
      labelled('Direction', fill.direction, 'exchange-reported'),
      labelled('Size', fill.size, 'exchange-reported'),
      labelled('Price', fill.price, 'exchange-reported'),
      labelled('Fee', fill.fee, 'exchange-reported'),
      labelled('Closed PnL', fill.closedPnl, 'exchange-reported'),
    ]),
  ];
}

function fundingSections(funding: HyperliquidFunding[]): string[] {
  const total = sumDecimalStrings(funding.map((record) => record.amount));
  if (funding.length === 0) {
    return ['FUNDING', 'No saved funding records. [locally counted]'];
  }
  return [
    'FUNDING',
    labelled('Synchronized total', total, 'locally summed'),
    ...funding.flatMap((record, index) => [
      `Funding ${String(index + 1)}`,
      `Timestamp: ${safeLine(record.eventTimestamp)} [saved]`,
      `Asset: ${safeLine(record.symbol)} [saved]`,
      labelled('Amount', record.amount, 'exchange-reported'),
      labelled('Rate', record.fundingRate, 'exchange-reported'),
    ]),
  ];
}

function orderSections(orders: HyperliquidOpenOrder[]): string[] {
  if (orders.length === 0) {
    return ['OPEN ORDERS', 'No saved open orders. [locally counted]'];
  }
  return [
    'OPEN ORDERS',
    ...orders.flatMap((order, index) => [
      `Order ${String(index + 1)}`,
      `Asset: ${safeLine(order.symbol)} [saved]`,
      `Side: ${safeLine(order.side)} [exchange-reported]`,
      labelled('Size', order.size, 'exchange-reported'),
      labelled('Price', order.price, 'exchange-reported'),
      labelled('Type', order.orderType, 'exchange-reported'),
      labelled('Trigger', order.triggerPrice, 'exchange-reported'),
      `Reduce-only: ${order.reduceOnly === undefined ? 'Unavailable' : String(order.reduceOnly)} [exchange-reported]`,
    ]),
  ];
}

function labelled(label: string, value: string | undefined, source: string): string {
  return `${label}: ${value ? safeLine(formatDecimal(value, 8)) : 'Unavailable'} [${source}]`;
}

function safeLine(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 160);
}

function enforceBudget(content: string, maximumCharacters: number): string {
  if (content.length <= maximumCharacters) {
    return content;
  }
  const marker = '\n[truncated deterministically]';
  if (maximumCharacters <= marker.length) {
    return marker.slice(0, maximumCharacters);
  }
  return `${content.slice(0, maximumCharacters - marker.length)}${marker}`;
}
