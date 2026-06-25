import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingService } from './tauri/tradingService';
import {
  loadActiveTradingAccountId,
  saveActiveTradingAccountId,
  subscribeActiveTradingAccount,
} from './tradingRuntimeStore';

const legacyKey = 'trading-buddy.activeHyperliquidAccountId';

describe('trading runtime account store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads the Rust-owned active account and removes the legacy browser value', async () => {
    window.localStorage.setItem(legacyKey, 'legacy');
    const { tradingService, setActiveAccountId } = service({ persisted: 'rust-account' });

    await expect(loadActiveTradingAccountId(tradingService)).resolves.toBe('rust-account');

    expect(setActiveAccountId).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('migrates one legacy browser value when Rust has no active account', async () => {
    window.localStorage.setItem(legacyKey, 'legacy-account');
    const { tradingService, setActiveAccountId } = service({
      persisted: null,
      saved: 'legacy-account',
    });

    await expect(loadActiveTradingAccountId(tradingService)).resolves.toBe('legacy-account');

    expect(setActiveAccountId).toHaveBeenCalledWith('legacy-account');
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('clears an invalid legacy value without keeping a second source of truth', async () => {
    window.localStorage.setItem(legacyKey, 'deleted-account');
    const { tradingService } = service({ persisted: null, rejectSave: true });

    await expect(loadActiveTradingAccountId(tradingService)).resolves.toBeNull();

    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('notifies same-window subscribers after saving through Rust', async () => {
    const { tradingService, setActiveAccountId } = service({ persisted: null, saved: 'account-2' });
    const handler = vi.fn();
    const unsubscribe = subscribeActiveTradingAccount(handler);

    await saveActiveTradingAccountId('account-2', tradingService);
    unsubscribe();

    expect(setActiveAccountId).toHaveBeenCalledWith('account-2');
    expect(handler).toHaveBeenCalledWith('account-2');
  });
});

function service(options: {
  persisted: string | null;
  saved?: string | null;
  rejectSave?: boolean;
}): { tradingService: TradingService; setActiveAccountId: ReturnType<typeof vi.fn> } {
  const setActiveAccountId = options.rejectSave
    ? vi.fn().mockRejectedValue(new Error('missing'))
    : vi.fn().mockResolvedValue(options.saved ?? null);
  const tradingService = {
    getActiveAccountId: vi.fn().mockResolvedValue(options.persisted),
    setActiveAccountId,
    validateAddress: vi.fn(),
    createAccount: vi.fn(),
    listAccounts: vi.fn(),
    summary: vi.fn(),
    sync: vi.fn(),
    cancelSync: vi.fn(),
    syncProgress: vi.fn(),
    diagnostics: vi.fn(),
    fixtureScenarios: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    disconnect: vi.fn(),
    deleteLocalData: vi.fn(),
    positions: vi.fn(),
    fills: vi.fn(),
    funding: vi.fn(),
    openOrders: vi.fn(),
  };
  return { tradingService, setActiveAccountId };
}
