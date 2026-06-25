export type TradingIntent =
  | 'connect_hyperliquid'
  | 'show_account'
  | 'show_positions'
  | 'show_recent_fills'
  | 'show_funding'
  | 'show_open_orders'
  | 'refresh_hyperliquid'
  | 'open_trading_home'
  | 'unsupported_trade_execution'
  | 'none';

export function detectTradingIntent(message: string): TradingIntent {
  const normalized = message.toLowerCase();
  if (/\b(close|open|cancel|buy|sell|long|short)\b/.test(normalized)) {
    return 'unsupported_trade_execution';
  }
  if (normalized.includes('connect') && normalized.includes('hyperliquid')) {
    return 'connect_hyperliquid';
  }
  if (normalized.includes('refresh') && normalized.includes('hyperliquid')) {
    return 'refresh_hyperliquid';
  }
  if (normalized.includes('position')) {
    return 'show_positions';
  }
  if (normalized.includes('funding')) {
    return 'show_funding';
  }
  if (normalized.includes('fill')) {
    return 'show_recent_fills';
  }
  if (normalized.includes('order')) {
    return 'show_open_orders';
  }
  if (normalized.includes('account')) {
    return 'show_account';
  }
  return 'none';
}
