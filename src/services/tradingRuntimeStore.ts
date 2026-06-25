import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriTradingService, type TradingService } from './tauri/tradingService';

const LEGACY_ACTIVE_ACCOUNT_KEY = 'trading-buddy.activeHyperliquidAccountId';
const ACTIVE_ACCOUNT_EVENT = 'trading-buddy://active-trading-account-changed';
const SAME_WINDOW_ACTIVE_ACCOUNT_EVENT = 'trading-buddy:active-account-changed';

interface ActiveAccountEventPayload {
  accountId: string | null;
}

export async function loadActiveTradingAccountId(
  tradingService: TradingService = tauriTradingService,
): Promise<string | null> {
  try {
    const persisted = await tradingService.getActiveAccountId();
    return await migrateLegacyActiveAccountId(tradingService, persisted);
  } catch {
    clearLegacyActiveAccountId();
    return null;
  }
}

export async function saveActiveTradingAccountId(
  accountId: string | null,
  tradingService: TradingService = tauriTradingService,
): Promise<string | null> {
  const persisted = await tradingService.setActiveAccountId(accountId);
  clearLegacyActiveAccountId();
  dispatchSameWindowActiveAccountChanged(persisted);
  return persisted;
}

export function subscribeActiveTradingAccount(
  handler: (accountId: string | null) => void,
): () => void {
  const onSameWindow = (event: Event) => {
    const detail = (event as CustomEvent<ActiveAccountEventPayload>).detail;
    handler(isActiveAccountPayload(detail) ? detail.accountId : null);
  };
  window.addEventListener(SAME_WINDOW_ACTIVE_ACCOUNT_EVENT, onSameWindow);

  let disposed = false;
  let unlistenPromise: Promise<UnlistenFn> | null = null;
  if (isTauriRuntime()) {
    unlistenPromise = listen<unknown>(ACTIVE_ACCOUNT_EVENT, (event) => {
      if (isActiveAccountPayload(event.payload)) {
        handler(event.payload.accountId);
      }
    });
  }

  return () => {
    disposed = true;
    window.removeEventListener(SAME_WINDOW_ACTIVE_ACCOUNT_EVENT, onSameWindow);
    if (unlistenPromise) {
      void unlistenPromise.then((unlisten) => {
        if (disposed) {
          unlisten();
        }
      });
    }
  };
}

async function migrateLegacyActiveAccountId(
  tradingService: TradingService,
  persisted: string | null,
): Promise<string | null> {
  const legacy = readLegacyActiveAccountId();
  if (persisted || !legacy) {
    clearLegacyActiveAccountId();
    return persisted;
  }
  try {
    const migrated = await tradingService.setActiveAccountId(legacy);
    clearLegacyActiveAccountId();
    dispatchSameWindowActiveAccountChanged(migrated);
    return migrated;
  } catch {
    clearLegacyActiveAccountId();
    return null;
  }
}

function readLegacyActiveAccountId(): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }
  const value = window.localStorage.getItem(LEGACY_ACTIVE_ACCOUNT_KEY);
  return value && value.trim().length > 0 ? value : null;
}

function clearLegacyActiveAccountId(): void {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(LEGACY_ACTIVE_ACCOUNT_KEY);
  }
}

function dispatchSameWindowActiveAccountChanged(accountId: string | null): void {
  window.dispatchEvent(
    new CustomEvent<ActiveAccountEventPayload>(SAME_WINDOW_ACTIVE_ACCOUNT_EVENT, {
      detail: { accountId },
    }),
  );
}

function isActiveAccountPayload(value: unknown): value is ActiveAccountEventPayload {
  if (typeof value !== 'object' || value === null || !('accountId' in value)) {
    return false;
  }
  return value.accountId === null || typeof value.accountId === 'string';
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && 'localStorage' in window;
}
