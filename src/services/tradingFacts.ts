import type { TradingFacts } from '../domain/trading/context';
import type { TradingIntent } from '../domain/trading/intents';
import type { TradingService } from './tauri/tradingService';

export async function fetchTradingFacts(
  tradingService: TradingService,
  accountId: string,
  intent: TradingIntent,
): Promise<TradingFacts> {
  const [summary, sync] = await Promise.all([
    tradingService.summary(accountId),
    tradingService.syncProgress(accountId),
  ]);
  const [positions, fills, funding, orders] = await Promise.all([
    intent === 'show_positions' || intent === 'show_account'
      ? tradingService.positions(accountId)
      : Promise.resolve([]),
    intent === 'show_recent_fills' ? tradingService.fills(accountId) : Promise.resolve([]),
    intent === 'show_funding' ? tradingService.funding(accountId) : Promise.resolve([]),
    intent === 'show_open_orders' ? tradingService.openOrders(accountId) : Promise.resolve([]),
  ]);
  return {
    summary,
    sync,
    positions,
    fills,
    funding,
    orders,
  };
}
