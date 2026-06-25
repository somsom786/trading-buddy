const ACTIVE_ACCOUNT_KEY = 'trading-buddy.activeHyperliquidAccountId';
const ACTIVE_ACCOUNT_EVENT = 'trading-buddy:active-account-changed';

export function loadActiveTradingAccountId(): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }
  const value = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function saveActiveTradingAccountId(accountId: string | null): void {
  if (!canUseLocalStorage()) {
    return;
  }
  if (accountId) {
    window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  } else {
    window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(ACTIVE_ACCOUNT_EVENT, {
      detail: { accountId },
    }),
  );
}

export function subscribeActiveTradingAccount(
  handler: (accountId: string | null) => void,
): () => void {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ accountId?: unknown }>).detail;
    handler(typeof detail.accountId === 'string' ? detail.accountId : null);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACTIVE_ACCOUNT_KEY) {
      handler(event.newValue && event.newValue.trim().length > 0 ? event.newValue : null);
    }
  };
  window.addEventListener(ACTIVE_ACCOUNT_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ACTIVE_ACCOUNT_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && 'localStorage' in window;
}
