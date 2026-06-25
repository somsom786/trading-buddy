import { useEffect, useState } from 'react';
import type {
  HyperliquidDiagnostics,
  HyperliquidSyncProgress,
  HyperliquidSyncResult,
  IntegrationAccount,
} from '../../domain/trading/types';
import { tauriTradingService, type TradingService } from '../../services/tauri/tradingService';

interface TradingLabProps {
  tradingService?: TradingService;
}

export function TradingLab({ tradingService = tauriTradingService }: TradingLabProps) {
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('single_long');
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<HyperliquidDiagnostics | null>(null);
  const [progress, setProgress] = useState<HyperliquidSyncProgress | null>(null);
  const [lastResult, setLastResult] = useState<HyperliquidSyncResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshLab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshLab() {
    try {
      const [nextScenarios, nextAccounts, nextDiagnostics] = await Promise.all([
        tradingService.fixtureScenarios(),
        tradingService.listAccounts(),
        tradingService.diagnostics(),
      ]);
      setScenarios(nextScenarios);
      setAccounts(nextAccounts);
      setDiagnostics(nextDiagnostics);
      setSelectedAccountId((current) =>
        current.length > 0 ? current : (nextAccounts[0]?.id ?? ''),
      );
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function addFixture() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const account = await tradingService.createAccount({
        environment: 'testnet',
        publicAddress: '',
        fixtureScenario: selectedScenario,
        displayName: `Fixture ${selectedScenario}`,
      });
      setSelectedAccountId(account.id);
      setNotice(`Added fixture scenario ${selectedScenario}.`);
      await refreshLab();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function syncSelected(repeat = false) {
    if (!selectedAccountId) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const first = await tradingService.sync(selectedAccountId);
      const second = repeat ? await tradingService.sync(selectedAccountId) : null;
      setLastResult(second ?? first);
      setNotice(
        repeat
          ? 'Repeated fixture sync completed; unchanged counts should increase for duplicate rows.'
          : 'Fixture sync completed.',
      );
      setProgress(await tradingService.syncProgress(selectedAccountId));
      await refreshLab();
    } catch (caught) {
      setError(errorMessage(caught));
      setProgress(await safeProgress(tradingService, selectedAccountId));
      await refreshLab();
    } finally {
      setBusy(false);
    }
  }

  async function cancelSelected() {
    if (!selectedAccountId) {
      return;
    }
    try {
      setProgress(await tradingService.cancelSync(selectedAccountId));
      setNotice('Cancellation requested for the selected sync.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  return (
    <details className="storage-lab">
      <summary>Trading Lab · development only</summary>
      <div className="storage-lab__content">
        {notice ? <p className="status-banner status-banner--ok">{notice}</p> : null}
        {error ? <p className="status-banner status-banner--error">{error}</p> : null}

        <div className="trading-grid">
          <section className="trading-card">
            <h3>Fixture scenarios</h3>
            <label>
              Scenario
              <select
                value={selectedScenario}
                onChange={(event) => {
                  setSelectedScenario(event.currentTarget.value);
                }}
              >
                {scenarios.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {scenario}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button type="button" disabled={busy} onClick={() => void addFixture()}>
                Add fixture
              </button>
              <button type="button" className="secondary-button" onClick={() => void refreshLab()}>
                Refresh lab
              </button>
            </div>
          </section>

          <section className="trading-card">
            <h3>Sync controls</h3>
            {accounts.length > 0 ? (
              <label>
                Account
                <select
                  value={selectedAccountId}
                  onChange={(event) => {
                    setSelectedAccountId(event.currentTarget.value);
                  }}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName ?? account.displayAddress} ·{' '}
                      {account.fixtureScenario ?? 'live'}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted">No accounts yet. Add a fixture to begin QA.</p>
            )}
            <div className="button-row">
              <button
                type="button"
                disabled={busy || !selectedAccountId}
                onClick={() => void syncSelected()}
              >
                Sync once
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !selectedAccountId}
                onClick={() => void syncSelected(true)}
              >
                Sync twice
              </button>
              <button
                type="button"
                className="stop-button"
                disabled={!selectedAccountId}
                onClick={() => void cancelSelected()}
              >
                Cancel active sync
              </button>
            </div>
            <p className="muted">
              For cancellation QA, add and sync the <code>slow_sync</code> fixture, then cancel
              while it is running.
            </p>
          </section>
        </div>

        <dl>
          <dt>Selected fixture</dt>
          <dd>{selectedAccount?.fixtureScenario ?? 'not a fixture'}</dd>
          <dt>Progress</dt>
          <dd>
            {progress
              ? `${progress.status} · ${progress.currentResource ?? 'idle'} · ${String(
                  progress.resourcesCompleted.length,
                )} completed`
              : 'not checked'}
          </dd>
          <dt>Last result</dt>
          <dd>
            {lastResult
              ? `${lastResult.status} · ${String(lastResult.recordsInserted)} inserted · ${String(
                  lastResult.recordsUnchanged,
                )} unchanged`
              : 'none'}
          </dd>
          <dt>Accounts / fixtures</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.accountCount)} / ${String(diagnostics.fixtureAccountCount)}`
              : 'unknown'}
          </dd>
          <dt>Rows</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.positionCount)} positions · ${String(
                  diagnostics.fillCount,
                )} fills · ${String(diagnostics.fundingCount)} funding · ${String(
                  diagnostics.openOrderCount,
                )} orders`
              : 'unknown'}
          </dd>
          <dt>Sync runs</dt>
          <dd>
            {diagnostics
              ? `${String(diagnostics.syncRunCount)} total · ${String(
                  diagnostics.failedSyncCount,
                )} failed · ${String(diagnostics.cancelledSyncCount)} cancelled`
              : 'unknown'}
          </dd>
          <dt>Latest sync</dt>
          <dd>{diagnostics?.latestSyncStatus ?? 'none'}</dd>
        </dl>

        <p className="muted">
          Trading Lab is fixture-first and read-only. It does not expose private keys, signing,
          orders, withdrawals, arbitrary URLs, or raw provider request bodies.
        </p>
      </div>
    </details>
  );
}

async function safeProgress(
  tradingService: TradingService,
  accountId: string,
): Promise<HyperliquidSyncProgress | null> {
  try {
    return await tradingService.syncProgress(accountId);
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Trading Lab action failed.';
}
