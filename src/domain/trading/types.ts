export type HyperliquidEnvironment = 'mainnet' | 'testnet';
export type IntegrationAccountStatus = 'active' | 'paused' | 'error' | 'disconnected';

export interface TradingError {
  code: string;
  userMessage: string;
  technicalMessage?: string;
  retryable: boolean;
  provider: 'hyperliquid';
  resource?: string;
}

export interface IntegrationAccount {
  id: string;
  provider: 'hyperliquid';
  environment: HyperliquidEnvironment;
  publicAddress: string;
  normalizedAddress: string;
  displayAddress: string;
  displayName?: string;
  status: IntegrationAccountStatus;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncStartedAt?: string;
  lastSyncCompletedAt?: string;
  lastSyncErrorCode?: string;
  lastSuccessfulDataAt?: string;
  isFixture: boolean;
}

export type TradingDataFreshness =
  | { status: 'fresh'; ageSeconds: number }
  | { status: 'aging'; ageSeconds: number }
  | { status: 'stale'; ageSeconds: number }
  | { status: 'unknown' };

export interface HyperliquidAccountSummary {
  account: IntegrationAccount;
  accountValue?: string;
  totalMarginUsed?: string;
  withdrawable?: string;
  openPositionCount: number;
  fillCount: number;
  fundingCount: number;
  openOrderCount: number;
  lastSnapshotAt?: string;
  freshness: TradingDataFreshness;
  partialSync: boolean;
  readOnly: boolean;
}

export interface HyperliquidPosition {
  id: string;
  symbol: string;
  side: string;
  signedSize: string;
  absoluteSize: string;
  entryPrice?: string;
  markPrice?: string;
  notional?: string;
  leverageType?: string;
  leverageValue?: string;
  liquidationPrice?: string;
  marginUsed?: string;
  unrealizedPnl?: string;
  returnOnEquity?: string;
  snapshotTimestamp: string;
}

export interface HyperliquidFill {
  id: string;
  symbol: string;
  side: string;
  direction?: string;
  price: string;
  size: string;
  fee: string;
  feeToken?: string;
  closedPnl?: string;
  fillTimestamp: string;
}

export interface HyperliquidFunding {
  id: string;
  symbol: string;
  amount: string;
  fundingRate?: string;
  positionSize?: string;
  eventTimestamp: string;
}

export interface HyperliquidOpenOrder {
  id: string;
  sourceOrderId: string;
  symbol: string;
  side: string;
  orderType?: string;
  price?: string;
  size: string;
  originalSize?: string;
  reduceOnly?: boolean;
  triggerPrice?: string;
  orderTimestamp?: string;
}

export interface HyperliquidSyncResult {
  runId: string;
  status: string;
  resourcesCompleted: string[];
  errorCode?: string;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
}

export interface HyperliquidAddressValidation {
  valid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  error?: string;
}

export function isTradingError(value: unknown): value is TradingError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.userMessage === 'string' &&
    typeof value.retryable === 'boolean' &&
    value.provider === 'hyperliquid'
  );
}

export function normalizeTradingError(value: unknown): TradingError {
  if (isTradingError(value)) {
    return value;
  }
  return {
    code: 'resource_unavailable',
    userMessage: typeof value === 'string' ? value : 'Trading data is unavailable.',
    retryable: true,
    provider: 'hyperliquid',
  };
}

export class TradingException extends Error {
  constructor(public readonly detail: TradingError) {
    super(detail.userMessage);
  }
}

export function isIntegrationAccount(value: unknown): value is IntegrationAccount {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.provider === 'hyperliquid' &&
    (value.environment === 'mainnet' || value.environment === 'testnet') &&
    typeof value.normalizedAddress === 'string' &&
    typeof value.displayAddress === 'string' &&
    ['active', 'paused', 'error', 'disconnected'].includes(String(value.status)) &&
    typeof value.syncEnabled === 'boolean' &&
    typeof value.isFixture === 'boolean'
  );
}

export function isHyperliquidAddressValidation(
  value: unknown,
): value is HyperliquidAddressValidation {
  return isRecord(value) && typeof value.valid === 'boolean';
}

export function isHyperliquidAccountSummary(value: unknown): value is HyperliquidAccountSummary {
  return (
    isRecord(value) &&
    isIntegrationAccount(value.account) &&
    typeof value.openPositionCount === 'number' &&
    typeof value.fillCount === 'number' &&
    typeof value.fundingCount === 'number' &&
    typeof value.openOrderCount === 'number' &&
    isFreshness(value.freshness) &&
    typeof value.partialSync === 'boolean' &&
    value.readOnly === true
  );
}

export function isHyperliquidPosition(value: unknown): value is HyperliquidPosition {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.side === 'string' &&
    typeof value.signedSize === 'string'
  );
}

export function isHyperliquidFill(value: unknown): value is HyperliquidFill {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.price === 'string' &&
    typeof value.size === 'string'
  );
}

export function isHyperliquidFunding(value: unknown): value is HyperliquidFunding {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.amount === 'string'
  );
}

export function isHyperliquidOpenOrder(value: unknown): value is HyperliquidOpenOrder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sourceOrderId === 'string' &&
    typeof value.symbol === 'string'
  );
}

export function isHyperliquidSyncResult(value: unknown): value is HyperliquidSyncResult {
  return (
    isRecord(value) &&
    typeof value.runId === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.resourcesCompleted)
  );
}

function isFreshness(value: unknown): value is TradingDataFreshness {
  return (
    isRecord(value) &&
    (value.status === 'unknown' ||
      ((value.status === 'fresh' || value.status === 'aging' || value.status === 'stale') &&
        typeof value.ageSeconds === 'number'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
