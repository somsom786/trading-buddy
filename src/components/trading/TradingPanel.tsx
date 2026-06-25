import { useEffect, useState } from 'react';
import { freshnessLabel, formatDecimal } from '../../domain/trading/formatting';
import { normalizeActiveAccountSelection } from '../../domain/trading/runtime';
import type {
  HyperliquidAccountSummary,
  HyperliquidEnvironment,
  HyperliquidFill,
  HyperliquidFunding,
  HyperliquidOpenOrder,
  HyperliquidPosition,
  IntegrationAccount,
} from '../../domain/trading/types';
import { tauriTradingService, type TradingService } from '../../services/tauri/tradingService';
import {
  loadActiveTradingAccountId,
  saveActiveTradingAccountId,
  subscribeActiveTradingAccount,
} from '../../services/tradingRuntimeStore';

interface TradingPanelProps {
  tradingService?: TradingService;
}

export function TradingPanel({ tradingService = tauriTradingService }: TradingPanelProps) {
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() =>
    loadActiveTradingAccountId(),
  );
  const [summary, setSummary] = useState<HyperliquidAccountSummary | null>(null);
  const [positions, setPositions] = useState<HyperliquidPosition[]>([]);
  const [fills, setFills] = useState<HyperliquidFill[]>([]);
  const [funding, setFunding] = useState<HyperliquidFunding[]>([]);
  const [orders, setOrders] = useState<HyperliquidOpenOrder[]>([]);
  const [environment, setEnvironment] = useState<HyperliquidEnvironment>('testnet');
  const [address, setAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeActiveTradingAccount((accountId) => {
      setSelectedAccountId(accountId);
    });
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      void refreshAccountDetail(selectedAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;

  async function refreshAccounts() {
    try {
      const nextAccounts = await tradingService.listAccounts();
      setAccounts(nextAccounts);
      setSelectedAccountId((current) => {
        const normalized = normalizeActiveAccountSelection(nextAccounts, current);
        if (normalized !== current) {
          saveActiveTradingAccountId(normalized);
        }
        return normalized;
      });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function refreshAccountDetail(accountId: string) {
    try {
      setSummary(await tradingService.summary(accountId));
      setPositions(await tradingService.positions(accountId));
      setFills(await tradingService.fills(accountId));
      setFunding(await tradingService.funding(accountId));
      setOrders(await tradingService.openOrders(accountId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function connect(fixtureScenario?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!fixtureScenario) {
        const validation = await tradingService.validateAddress(address);
        if (!validation.valid) {
          setError(validation.error ?? 'Enter a valid public Hyperliquid address.');
          return;
        }
      }
      const account = await tradingService.createAccount({
        environment,
        publicAddress: address,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(fixtureScenario ? { fixtureScenario } : {}),
      });
      setNotice('Hyperliquid account saved locally. It is read-only.');
      await refreshAccounts();
      chooseAccount(account.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    if (!selectedAccountId) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await tradingService.sync(selectedAccountId);
      setNotice(
        `Read-only sync completed · ${String(result.recordsInserted)} inserted · ${String(
          result.recordsUnchanged,
        )} unchanged`,
      );
      await refreshAccounts();
      await refreshAccountDetail(selectedAccountId);
    } catch (caught) {
      setError(errorMessage(caught));
      await refreshAccounts();
      await refreshAccountDetail(selectedAccountId);
    } finally {
      setBusy(false);
    }
  }

  async function accountAction(action: 'pause' | 'resume' | 'disconnect' | 'delete') {
    if (!selectedAccountId) {
      return;
    }
    if (action === 'delete' && !window.confirm('Delete this local Hyperliquid data?')) {
      return;
    }
    setBusy(true);
    try {
      if (action === 'pause') {
        await tradingService.pause(selectedAccountId);
      } else if (action === 'resume') {
        await tradingService.resume(selectedAccountId);
      } else if (action === 'disconnect') {
        await tradingService.disconnect(selectedAccountId);
      } else {
        await tradingService.deleteLocalData(selectedAccountId);
        saveActiveTradingAccountId(null);
        setSelectedAccountId(null);
        setSummary(null);
      }
      await refreshAccounts();
      if (action !== 'delete') {
        await refreshAccountDetail(selectedAccountId);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="trading-panel" aria-labelledby="trading-panel-title">
      <header className="memory-panel__header">
        <div>
          <p className="eyebrow">Read-only integration</p>
          <h2 id="trading-panel-title">Trading</h2>
        </div>
        <span className="storage-pill">Hyperliquid · no execution</span>
      </header>

      <p className="muted">
        Trading Buddy only reads public Hyperliquid account data. It cannot place trades, sign
        transactions, or move funds.
      </p>

      {notice ? <p className="status-banner status-banner--ok">{notice}</p> : null}
      {error ? <p className="status-banner status-banner--error">{error}</p> : null}

      <div className="trading-grid">
        <form
          className="trading-card"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <h3>Connect public account</h3>
          <label>
            Environment
            <select
              value={environment}
              onChange={(event) => {
                setEnvironment(event.currentTarget.value as HyperliquidEnvironment);
              }}
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </label>
          <label>
            Public address
            <input
              value={address}
              onChange={(event) => {
                setAddress(event.currentTarget.value);
              }}
              placeholder="0x..."
            />
          </label>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.currentTarget.value);
              }}
              placeholder="Optional"
            />
          </label>
          <button type="submit" disabled={busy}>
            Connect read-only
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                void connect('single_long');
              }}
            >
              Add fixture account
            </button>
          ) : null}
        </form>

        <section className="trading-card">
          <h3>Connected account</h3>
          {accounts.length > 0 ? (
            <label>
              Account
              <select
                value={selectedAccountId ?? ''}
                onChange={(event) => {
                  chooseAccount(event.currentTarget.value);
                }}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName ?? account.displayAddress} · {account.environment}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted">No Hyperliquid account connected yet.</p>
          )}
          {selectedAccount ? (
            <>
              <dl className="storage-facts">
                <dt>Status</dt>
                <dd>{selectedAccount.status}</dd>
                <dt>Address</dt>
                <dd>{selectedAccount.displayAddress}</dd>
                <dt>Freshness</dt>
                <dd>{summary ? freshnessLabel(summary.freshness) : 'Unknown'}</dd>
                <dt>Fixture</dt>
                <dd>{selectedAccount.isFixture ? 'Synthetic fixture data' : 'No'}</dd>
              </dl>
              <div className="button-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void sync();
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    void accountAction(selectedAccount.status === 'paused' ? 'resume' : 'pause');
                  }}
                >
                  {selectedAccount.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    void accountAction('disconnect');
                  }}
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  className="stop-button"
                  disabled={busy}
                  onClick={() => {
                    void accountAction('delete');
                  }}
                >
                  Delete local data
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {summary ? (
        <section className="trading-card trading-card--wide">
          <h3>Account summary</h3>
          <dl className="storage-facts">
            <dt>Account value</dt>
            <dd>{formatDecimal(summary.accountValue)}</dd>
            <dt>Margin used</dt>
            <dd>{formatDecimal(summary.totalMarginUsed)}</dd>
            <dt>Withdrawable</dt>
            <dd>{formatDecimal(summary.withdrawable)}</dd>
            <dt>Open positions</dt>
            <dd>{summary.openPositionCount}</dd>
            <dt>Recent fills stored</dt>
            <dd>{summary.fillCount}</dd>
            <dt>Funding rows stored</dt>
            <dd>{summary.fundingCount}</dd>
            <dt>Open orders</dt>
            <dd>{summary.openOrderCount}</dd>
          </dl>
          {summary.partialSync ? (
            <p className="muted">Last refresh was partial; showing saved data.</p>
          ) : null}
        </section>
      ) : null}

      <div className="trading-grid">
        <MiniTable
          title="Positions"
          empty="No open positions in the saved snapshot."
          rows={positions.map((position) => [
            position.symbol,
            position.side,
            formatDecimal(position.absoluteSize),
            formatDecimal(position.entryPrice),
            formatDecimal(position.markPrice),
            formatDecimal(position.unrealizedPnl),
          ])}
        />
        <MiniTable
          title="Recent fills"
          empty="No fills synchronized yet."
          rows={fills.map((fill) => [
            fill.symbol,
            fill.side,
            formatDecimal(fill.price),
            formatDecimal(fill.size),
            formatDecimal(fill.fee),
            new Date(fill.fillTimestamp).toLocaleString(),
          ])}
        />
        <MiniTable
          title="Funding"
          empty="No funding synchronized yet."
          rows={funding.map((item) => [
            item.symbol,
            formatDecimal(item.amount),
            formatDecimal(item.fundingRate),
            new Date(item.eventTimestamp).toLocaleString(),
          ])}
        />
        <MiniTable
          title="Open orders"
          empty="No open orders in the saved snapshot."
          rows={orders.map((order) => [
            order.symbol,
            order.side,
            formatDecimal(order.price),
            formatDecimal(order.size),
            order.reduceOnly ? 'reduce-only' : 'standard',
          ])}
        />
      </div>
    </section>
  );
}

function chooseAccount(accountId: string | null) {
  saveActiveTradingAccountId(accountId);
}

function MiniTable({ title, empty, rows }: { title: string; empty: string; rows: string[][] }) {
  return (
    <section className="trading-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="mini-table">
          {rows.map((row) => (
            <p key={row.join('|')}>{row.join(' · ')}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Trading data is unavailable.';
}
