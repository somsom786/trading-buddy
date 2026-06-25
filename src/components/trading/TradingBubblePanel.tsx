import { useEffect, useMemo, useState } from 'react';
import { sumDecimalStrings } from '../../domain/trading/decimal';
import { freshnessLabel, formatDecimal } from '../../domain/trading/formatting';
import {
  isSyncActive,
  normalizeActiveAccountSelection,
  syncPhaseLabel,
} from '../../domain/trading/runtime';
import type {
  HyperliquidAccountSummary,
  HyperliquidFill,
  HyperliquidFunding,
  HyperliquidOpenOrder,
  HyperliquidPosition,
  HyperliquidSyncProgress,
  HyperliquidSyncResult,
  IntegrationAccount,
} from '../../domain/trading/types';
import { tauriTradingService, type TradingService } from '../../services/tauri/tradingService';
import {
  loadActiveTradingAccountId,
  saveActiveTradingAccountId,
  subscribeActiveTradingAccount,
} from '../../services/tradingRuntimeStore';
import type { WindowService } from '../../services/windowService';

export type BubbleTradingView = 'account' | 'positions' | 'fills' | 'funding' | 'orders' | 'sync';

interface TradingBubblePanelProps {
  tradingService?: TradingService;
  windowService: WindowService;
  localAiOffline: boolean;
}

export function TradingBubblePanel({
  tradingService = tauriTradingService,
  windowService,
  localAiOffline,
}: TradingBubblePanelProps) {
  const [view, setView] = useState<BubbleTradingView | null>(null);
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [summary, setSummary] = useState<HyperliquidAccountSummary | null>(null);
  const [positions, setPositions] = useState<HyperliquidPosition[]>([]);
  const [fills, setFills] = useState<HyperliquidFill[]>([]);
  const [funding, setFunding] = useState<HyperliquidFunding[]>([]);
  const [orders, setOrders] = useState<HyperliquidOpenOrder[]>([]);
  const [progress, setProgress] = useState<HyperliquidSyncProgress | null>(null);
  const [lastResult, setLastResult] = useState<HyperliquidSyncResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refreshAccountsAndSelection();
    return subscribeActiveTradingAccount((accountId) => {
      setActiveAccountId(accountId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeAccountId) {
      return;
    }
    void refreshSelectedFacts(activeAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId || (!refreshing && !isSyncActive(progress))) {
      return;
    }
    const timer = window.setInterval(() => {
      void tradingService
        .syncProgress(activeAccountId)
        .then(setProgress)
        .catch(() => undefined);
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeAccountId, progress, refreshing, tradingService]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && view) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setView(null);
      }
    };
    window.addEventListener('keydown', onEscape, { capture: true });
    return () => {
      window.removeEventListener('keydown', onEscape, { capture: true });
    };
  }, [view]);

  async function refreshAccountsAndSelection() {
    try {
      const nextAccounts = await tradingService.listAccounts();
      setAccounts(nextAccounts);
      const persisted = await loadActiveTradingAccountId(tradingService);
      const normalized = normalizeActiveAccountSelection(nextAccounts, persisted);
      if (normalized !== persisted) {
        await saveActiveTradingAccountId(normalized, tradingService);
      }
      setActiveAccountId(normalized);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function refreshSelectedFacts(accountId: string) {
    try {
      const [nextSummary, nextProgress] = await Promise.all([
        tradingService.summary(accountId),
        tradingService.syncProgress(accountId),
      ]);
      setSummary(nextSummary);
      setProgress(nextProgress);
      if (view === 'positions') {
        setPositions(await tradingService.positions(accountId));
      }
      if (view === 'fills') {
        setFills(await tradingService.fills(accountId));
      }
      if (view === 'funding') {
        setFunding(await tradingService.funding(accountId));
      }
      if (view === 'orders') {
        setOrders(await tradingService.openOrders(accountId));
      }
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function openView(nextView: BubbleTradingView) {
    setView(nextView);
    if (!activeAccountId) {
      return;
    }
    await refreshSelectedFacts(activeAccountId);
    if (nextView === 'positions') {
      setPositions(await tradingService.positions(activeAccountId));
    }
    if (nextView === 'fills') {
      setFills(await tradingService.fills(activeAccountId));
    }
    if (nextView === 'funding') {
      setFunding(await tradingService.funding(activeAccountId));
    }
    if (nextView === 'orders') {
      setOrders(await tradingService.openOrders(activeAccountId));
    }
  }

  async function refreshAccount() {
    if (!activeAccountId) {
      setView('account');
      return;
    }
    setView('sync');
    setRefreshing(true);
    setNotice(null);
    setError(null);
    setProgress({
      accountId: activeAccountId,
      status: 'running',
      currentResource: 'metadata',
      resourcesCompleted: [],
      cancelRequested: false,
    });
    try {
      const result = await tradingService.sync(activeAccountId);
      setLastResult(result);
      setNotice(
        `Refresh completed: ${String(result.recordsInserted)} inserted, ${String(
          result.recordsUnchanged,
        )} unchanged.`,
      );
      await refreshSelectedFacts(activeAccountId);
      await refreshAccountsAndSelection();
    } catch (caught) {
      setError(errorMessage(caught));
      await refreshSelectedFacts(activeAccountId);
    } finally {
      setRefreshing(false);
    }
  }

  async function stopRefresh() {
    if (!activeAccountId) {
      return;
    }
    try {
      setProgress(await tradingService.cancelSync(activeAccountId));
      setNotice('Stop requested. Saved data remains available.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;
  const showStop = isSyncActive(progress) || refreshing;
  const fundingTotal = useMemo(
    () => sumDecimalStrings(funding.map((record) => record.amount)),
    [funding],
  );

  return (
    <section className="bubble-trading" aria-label="Read-only trading facts">
      <div className="bubble-trading__actions" aria-label="Trading quick actions">
        <button
          type="button"
          onClick={() => {
            void openView('account');
          }}
        >
          Account
        </button>
        <button
          type="button"
          onClick={() => {
            void openView('positions');
          }}
        >
          Positions
        </button>
        <button
          type="button"
          onClick={() => {
            void openView('fills');
          }}
        >
          Recent fills
        </button>
        <button
          type="button"
          onClick={() => {
            void openView('funding');
          }}
        >
          Funding
        </button>
        <button
          type="button"
          onClick={() => {
            void openView('orders');
          }}
        >
          Open orders
        </button>
        <button
          type="button"
          onClick={() => {
            void refreshAccount();
          }}
        >
          Refresh
        </button>
      </div>

      {localAiOffline ? (
        <p className="bubble-trading__note">
          Local AI is offline, but saved account facts are still available.
        </p>
      ) : null}

      {view ? (
        <section className="bubble-trading-card" tabIndex={-1}>
          <header>
            <strong>{cardTitle(view)}</strong>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setView(null);
              }}
            >
              Close
            </button>
          </header>

          {!activeAccount ? (
            <div>
              <p>No Hyperliquid account is selected.</p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => {
                    void windowService.openMainWindow();
                  }}
                >
                  Connect account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void windowService.openMainWindow();
                  }}
                >
                  Open Trading
                </button>
              </div>
            </div>
          ) : null}

          {activeAccount && view === 'account' && summary ? (
            <AccountCard summary={summary} progress={progress} />
          ) : null}
          {activeAccount && view === 'positions' && summary ? (
            <PositionsCard summary={summary} positions={positions} />
          ) : null}
          {activeAccount && view === 'fills' && summary ? (
            <FillsCard summary={summary} fills={fills} />
          ) : null}
          {activeAccount && view === 'funding' && summary ? (
            <FundingCard summary={summary} funding={funding} fundingTotal={fundingTotal} />
          ) : null}
          {activeAccount && view === 'orders' && summary ? (
            <OrdersCard summary={summary} orders={orders} />
          ) : null}
          {activeAccount && view === 'sync' ? (
            <SyncCard progress={progress} result={lastResult} />
          ) : null}

          {notice ? <p className="status-banner status-banner--ok">{notice}</p> : null}
          {error ? <p className="status-banner status-banner--error">{error}</p> : null}

          {activeAccount ? (
            <div className="button-row">
              <button
                type="button"
                disabled={refreshing}
                onClick={() => {
                  void refreshAccount();
                }}
              >
                Refresh
              </button>
              {showStop ? (
                <button
                  type="button"
                  className="stop-button"
                  onClick={() => {
                    void stopRefresh();
                  }}
                >
                  Stop
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void windowService.openMainWindow();
                }}
              >
                Open Trading
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function AccountCard({
  summary,
  progress,
}: {
  summary: HyperliquidAccountSummary;
  progress: HyperliquidSyncProgress | null;
}) {
  return (
    <dl className="bubble-trading-facts">
      <dt>Name</dt>
      <dd>{summary.account.displayName ?? summary.account.displayAddress}</dd>
      <dt>Environment</dt>
      <dd>{summary.account.environment}</dd>
      <dt>Source</dt>
      <dd>{summary.account.isFixture ? 'Fixture data' : 'Saved public account'}</dd>
      <dt>Address</dt>
      <dd>{summary.account.displayAddress}</dd>
      <dt>Status</dt>
      <dd>{summary.account.status}</dd>
      <dt>Last successful sync</dt>
      <dd>{summary.account.lastSuccessfulDataAt ?? 'Unavailable'}</dd>
      <dt>Freshness</dt>
      <dd>{freshnessLabel(summary.freshness)}</dd>
      <dt>Sync phase</dt>
      <dd>{syncPhaseLabel(progress)}</dd>
      <dt>Partial</dt>
      <dd>{summary.partialSync ? 'Saved data may be partial' : 'No partial state recorded'}</dd>
      <dt>Open positions</dt>
      <dd>{String(summary.openPositionCount)} locally counted</dd>
      <dt>Account value</dt>
      <dd>{formatDecimal(summary.accountValue)} exchange-reported</dd>
      <dt>Margin used</dt>
      <dd>{formatDecimal(summary.totalMarginUsed)} exchange-reported</dd>
      <dt>Withdrawable</dt>
      <dd>{formatDecimal(summary.withdrawable)} exchange-reported</dd>
    </dl>
  );
}

function PositionsCard({
  summary,
  positions,
}: {
  summary: HyperliquidAccountSummary;
  positions: HyperliquidPosition[];
}) {
  const shown = positions.slice(0, 5);
  return (
    <div>
      <p className="muted">
        {freshnessLabel(summary.freshness)} ·{' '}
        {summary.account.isFixture ? 'Fixture data' : 'Saved data'}
      </p>
      {shown.length === 0 ? <p>No saved open positions.</p> : null}
      {shown.map((position) => (
        <article key={position.id} className="bubble-trading-row">
          <strong>
            {position.symbol} · {position.side}
          </strong>
          <span>Size {formatDecimal(position.absoluteSize)}</span>
          <span>Entry {formatDecimal(position.entryPrice)}</span>
          <span>Mark {formatDecimal(position.markPrice)}</span>
          <span>Notional {formatDecimal(position.notional)}</span>
          <span>Lev {formatDecimal(position.leverageValue)}</span>
          <span>Liq {formatDecimal(position.liquidationPrice)}</span>
          <span>uPnL {formatDecimal(position.unrealizedPnl)}</span>
        </article>
      ))}
      {positions.length > shown.length ? (
        <p>+ {String(positions.length - shown.length)} more</p>
      ) : null}
    </div>
  );
}

function FillsCard({
  summary,
  fills,
}: {
  summary: HyperliquidAccountSummary;
  fills: HyperliquidFill[];
}) {
  const shown = fills.slice(0, 5);
  return (
    <div>
      <p className="muted">{freshnessLabel(summary.freshness)}</p>
      {shown.length === 0 ? <p>No saved fills.</p> : null}
      {shown.map((fill) => (
        <article key={fill.id} className="bubble-trading-row">
          <strong>
            {fill.symbol} · {fill.side}
          </strong>
          <span>{new Date(fill.fillTimestamp).toLocaleString()}</span>
          <span>{fill.direction ?? 'Direction unavailable'}</span>
          <span>Size {formatDecimal(fill.size)}</span>
          <span>Price {formatDecimal(fill.price)}</span>
          <span>Fee {formatDecimal(fill.fee)}</span>
          <span>Closed PnL {formatDecimal(fill.closedPnl)}</span>
        </article>
      ))}
    </div>
  );
}

function FundingCard({
  summary,
  funding,
  fundingTotal,
}: {
  summary: HyperliquidAccountSummary;
  funding: HyperliquidFunding[];
  fundingTotal: string | undefined;
}) {
  const shown = funding.slice(0, 5);
  return (
    <div>
      <p className="muted">{freshnessLabel(summary.freshness)}</p>
      <p>Total synchronized funding: {formatDecimal(fundingTotal)} locally summed</p>
      {shown.length === 0 ? <p>No saved funding records.</p> : null}
      {shown.map((record) => (
        <article key={record.id} className="bubble-trading-row">
          <strong>{record.symbol}</strong>
          <span>{new Date(record.eventTimestamp).toLocaleString()}</span>
          <span>Amount {formatDecimal(record.amount)}</span>
          <span>Rate {formatDecimal(record.fundingRate, 8)}</span>
        </article>
      ))}
    </div>
  );
}

function OrdersCard({
  summary,
  orders,
}: {
  summary: HyperliquidAccountSummary;
  orders: HyperliquidOpenOrder[];
}) {
  const shown = orders.slice(0, 5);
  return (
    <div>
      <p className="muted">{freshnessLabel(summary.freshness)}</p>
      {shown.length === 0 ? <p>No saved open orders.</p> : null}
      {shown.map((order) => (
        <article key={order.id} className="bubble-trading-row">
          <strong>
            {order.symbol} · {order.side}
          </strong>
          <span>Size {formatDecimal(order.size)}</span>
          <span>Price {formatDecimal(order.price)}</span>
          <span>{order.orderType ?? 'Type unavailable'}</span>
          <span>Trigger {formatDecimal(order.triggerPrice)}</span>
          <span>{order.reduceOnly ? 'Reduce-only' : 'Standard'}</span>
        </article>
      ))}
    </div>
  );
}

function SyncCard({
  progress,
  result,
}: {
  progress: HyperliquidSyncProgress | null;
  result: HyperliquidSyncResult | null;
}) {
  return (
    <dl className="bubble-trading-facts">
      <dt>Phase</dt>
      <dd>{syncPhaseLabel(progress)}</dd>
      <dt>Current resource</dt>
      <dd>{progress?.currentResource ?? 'Unavailable'}</dd>
      <dt>Completed resources</dt>
      <dd>
        {progress && progress.resourcesCompleted.length > 0
          ? progress.resourcesCompleted.join(', ')
          : 'None yet'}
      </dd>
      <dt>Stop requested</dt>
      <dd>{progress?.cancelRequested ? 'Yes' : 'No'}</dd>
      <dt>Last result</dt>
      <dd>
        {result
          ? `${result.status}: ${String(result.recordsInserted)} inserted, ${String(
              result.recordsUpdated,
            )} updated, ${String(result.recordsUnchanged)} unchanged`
          : 'Unavailable'}
      </dd>
    </dl>
  );
}

function cardTitle(view: BubbleTradingView): string {
  switch (view) {
    case 'account':
      return 'Account facts';
    case 'positions':
      return 'Positions';
    case 'fills':
      return 'Recent fills';
    case 'funding':
      return 'Funding';
    case 'orders':
      return 'Open orders';
    case 'sync':
      return 'Sync progress';
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Trading facts are unavailable.';
}
