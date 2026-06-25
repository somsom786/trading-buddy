import { invoke } from '@tauri-apps/api/core';
import {
  isHyperliquidAccountSummary,
  isHyperliquidAddressValidation,
  isHyperliquidDiagnostics,
  isHyperliquidFill,
  isHyperliquidFunding,
  isHyperliquidOpenOrder,
  isHyperliquidPosition,
  isHyperliquidSyncProgress,
  isHyperliquidSyncResult,
  isIntegrationAccount,
  normalizeTradingError,
  TradingException,
  type HyperliquidAccountSummary,
  type HyperliquidAddressValidation,
  type HyperliquidDiagnostics,
  type HyperliquidEnvironment,
  type HyperliquidFill,
  type HyperliquidFunding,
  type HyperliquidOpenOrder,
  type HyperliquidPosition,
  type HyperliquidSyncProgress,
  type HyperliquidSyncResult,
  type IntegrationAccount,
} from '../../domain/trading/types';

export interface TradingService {
  validateAddress(address: string): Promise<HyperliquidAddressValidation>;
  createAccount(options: {
    environment: HyperliquidEnvironment;
    publicAddress: string;
    displayName?: string;
    fixtureScenario?: string;
  }): Promise<IntegrationAccount>;
  listAccounts(): Promise<IntegrationAccount[]>;
  summary(accountId: string): Promise<HyperliquidAccountSummary>;
  sync(accountId: string): Promise<HyperliquidSyncResult>;
  cancelSync(accountId: string): Promise<HyperliquidSyncProgress>;
  syncProgress(accountId: string): Promise<HyperliquidSyncProgress>;
  diagnostics(): Promise<HyperliquidDiagnostics>;
  fixtureScenarios(): Promise<string[]>;
  pause(accountId: string): Promise<IntegrationAccount>;
  resume(accountId: string): Promise<IntegrationAccount>;
  disconnect(accountId: string): Promise<IntegrationAccount>;
  deleteLocalData(accountId: string): Promise<void>;
  positions(accountId: string): Promise<HyperliquidPosition[]>;
  fills(accountId: string): Promise<HyperliquidFill[]>;
  funding(accountId: string): Promise<HyperliquidFunding[]>;
  openOrders(accountId: string): Promise<HyperliquidOpenOrder[]>;
}

export const tauriTradingService: TradingService = {
  validateAddress(address) {
    return invokeChecked(
      'validate_hyperliquid_address',
      { address },
      isHyperliquidAddressValidation,
    );
  },
  createAccount(options) {
    return invokeChecked('create_hyperliquid_account', { request: options }, isIntegrationAccount);
  },
  listAccounts() {
    return invokeChecked('list_hyperliquid_accounts', undefined, isAccountArray);
  },
  summary(accountId) {
    return invokeChecked(
      'get_hyperliquid_account_summary',
      { accountId },
      isHyperliquidAccountSummary,
    );
  },
  sync(accountId) {
    return invokeChecked('sync_hyperliquid_account', { accountId }, isHyperliquidSyncResult);
  },
  cancelSync(accountId) {
    return invokeChecked('cancel_hyperliquid_sync', { accountId }, isHyperliquidSyncProgress);
  },
  syncProgress(accountId) {
    return invokeChecked('get_hyperliquid_sync_progress', { accountId }, isHyperliquidSyncProgress);
  },
  diagnostics() {
    return invokeChecked('get_hyperliquid_sync_diagnostics', undefined, isHyperliquidDiagnostics);
  },
  fixtureScenarios() {
    return invokeChecked('list_hyperliquid_fixture_scenarios', undefined, isStringArray);
  },
  pause(accountId) {
    return invokeChecked('pause_hyperliquid_account', { accountId }, isIntegrationAccount);
  },
  resume(accountId) {
    return invokeChecked('resume_hyperliquid_account', { accountId }, isIntegrationAccount);
  },
  disconnect(accountId) {
    return invokeChecked('disconnect_hyperliquid_account', { accountId }, isIntegrationAccount);
  },
  async deleteLocalData(accountId) {
    await invokeWrapped('delete_hyperliquid_local_data', { accountId });
  },
  positions(accountId) {
    return invokeChecked('list_hyperliquid_positions', { accountId }, isPositionArray);
  },
  fills(accountId) {
    return invokeChecked(
      'list_hyperliquid_fills',
      { accountId, limit: 25, offset: 0 },
      isFillArray,
    );
  },
  funding(accountId) {
    return invokeChecked(
      'list_hyperliquid_funding',
      { accountId, limit: 25, offset: 0 },
      isFundingArray,
    );
  },
  openOrders(accountId) {
    return invokeChecked(
      'list_hyperliquid_open_orders',
      { accountId, limit: 25, offset: 0 },
      isOpenOrderArray,
    );
  },
};

async function invokeChecked<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  guard: (value: unknown) => value is T,
): Promise<T> {
  const value = await invokeWrapped<unknown>(command, args);
  if (!guard(value)) {
    throw new TradingException(normalizeTradingError(`Invalid response from ${command}.`));
  }
  return value;
}

async function invokeWrapped<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    if (!('__TAURI_INTERNALS__' in window)) {
      throw new Error('Tauri runtime is not present.');
    }
    return await invoke<T>(command, args);
  } catch (error) {
    throw new TradingException(normalizeTradingError(error));
  }
}

const isAccountArray = (value: unknown): value is IntegrationAccount[] =>
  Array.isArray(value) && value.every(isIntegrationAccount);
const isPositionArray = (value: unknown): value is HyperliquidPosition[] =>
  Array.isArray(value) && value.every(isHyperliquidPosition);
const isFillArray = (value: unknown): value is HyperliquidFill[] =>
  Array.isArray(value) && value.every(isHyperliquidFill);
const isFundingArray = (value: unknown): value is HyperliquidFunding[] =>
  Array.isArray(value) && value.every(isHyperliquidFunding);
const isOpenOrderArray = (value: unknown): value is HyperliquidOpenOrder[] =>
  Array.isArray(value) && value.every(isHyperliquidOpenOrder);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
