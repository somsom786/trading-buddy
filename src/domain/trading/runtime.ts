import type {
  HyperliquidAccountSummary,
  HyperliquidSyncProgress,
  IntegrationAccount,
  TradingDataFreshness,
  TradingError,
} from './types';

export interface TradingAccountRuntimeState {
  accountId: string;
  account: HyperliquidAccountSummary | null;
  sync: HyperliquidSyncProgress | null;
  freshness: TradingDataFreshness;
  lastError: TradingError | null;
  updatedAt: string;
}

export function normalizeActiveAccountSelection(
  accounts: IntegrationAccount[],
  currentAccountId: string | null,
): string | null {
  if (accounts.length === 0) {
    return null;
  }
  if (currentAccountId && accounts.some((account) => account.id === currentAccountId)) {
    return currentAccountId;
  }
  return accounts[0]?.id ?? null;
}

export function createRuntimeState(
  accountId: string,
  now: string,
  overrides: Partial<Omit<TradingAccountRuntimeState, 'accountId' | 'updatedAt'>> = {},
): TradingAccountRuntimeState {
  return {
    accountId,
    account: overrides.account ?? null,
    sync: overrides.sync ?? null,
    freshness: overrides.freshness ?? overrides.account?.freshness ?? { status: 'unknown' },
    lastError: overrides.lastError ?? null,
    updatedAt: now,
  };
}

export function isSyncActive(sync: HyperliquidSyncProgress | null | undefined): boolean {
  return sync?.status === 'running' || sync?.status === 'cancelling';
}

export function syncPhaseLabel(sync: HyperliquidSyncProgress | null | undefined): string {
  if (!sync || sync.status === 'idle') {
    return 'Idle';
  }
  if (sync.status === 'cancelling') {
    return 'Cancelling';
  }
  if (sync.status !== 'running') {
    return titleCase(sync.status);
  }
  switch (sync.currentResource) {
    case 'metadata':
      return 'Fetching metadata';
    case 'all_mids':
      return 'Fetching market mids';
    case 'account_state':
      return 'Fetching account state';
    case 'positions':
      return 'Loading positions';
    case 'fills':
      return 'Synchronizing fills';
    case 'funding':
      return 'Synchronizing funding';
    case 'open_orders':
      return 'Loading open orders';
    case 'saving':
      return 'Saving locally';
    default:
      return 'Starting';
  }
}

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
