export type TradingIntent =
  | 'connect_hyperliquid'
  | 'show_account'
  | 'show_positions'
  | 'show_recent_fills'
  | 'show_funding'
  | 'show_open_orders'
  | 'refresh_hyperliquid'
  | 'cancel_hyperliquid_sync'
  | 'open_trading_home'
  | 'unsupported_trade_execution'
  | 'not_trading_intent';

export function detectTradingIntent(message: string): TradingIntent {
  const normalized = message.toLowerCase();
  if (/\b(move|modify)\s+(my\s+)?(stop|order|position|trade)\b/.test(normalized)) {
    return 'unsupported_trade_execution';
  }
  if (/\b(close|buy|sell)\b/.test(normalized)) {
    return 'unsupported_trade_execution';
  }
  if (/\bopen\s+(a\s+)?(long|short|position|trade|order)\b/.test(normalized)) {
    return 'unsupported_trade_execution';
  }
  if (/\bcancel\s+(my\s+)?(order|orders|trade|trades)\b/.test(normalized)) {
    return 'unsupported_trade_execution';
  }
  if (
    /\b(stop|cancel)\b/.test(normalized) &&
    /\b(refresh|sync|synchronization)\b/.test(normalized)
  ) {
    return 'cancel_hyperliquid_sync';
  }
  if (/\bopen\b/.test(normalized) && /\b(trading|hyperliquid)\b/.test(normalized)) {
    return 'open_trading_home';
  }
  if (/\bconnect\b/.test(normalized) && /\bhyperliquid\b/.test(normalized)) {
    return 'connect_hyperliquid';
  }
  if (
    /\b(refresh|sync|synchronize)\b/.test(normalized) &&
    /\b(account|hyperliquid|trading)\b/.test(normalized)
  ) {
    return 'refresh_hyperliquid';
  }
  if (
    /\bpositions\b/.test(normalized) ||
    (/\bposition\b/.test(normalized) && hasNonPositionTradingContext(normalized))
  ) {
    return 'show_positions';
  }
  if (/\bfunding\b/.test(normalized) && hasTradingContext(normalized)) {
    return 'show_funding';
  }
  if (/\b(fills|trades|recent trades)\b/.test(normalized) && hasTradingContext(normalized)) {
    return 'show_recent_fills';
  }
  if (/\b(open orders|orders)\b/.test(normalized) && hasTradingContext(normalized)) {
    return 'show_open_orders';
  }
  if (
    /\b(account|balance|margin|withdrawable)\b/.test(normalized) &&
    hasTradingContext(normalized)
  ) {
    return 'show_account';
  }
  return 'not_trading_intent';
}

function hasTradingContext(message: string): boolean {
  return /\b(hyperliquid|account|trading|trade|trades|position|positions|funding|orders|fills|balance|margin|withdrawable)\b/.test(
    message,
  );
}

function hasNonPositionTradingContext(message: string): boolean {
  return /\b(hyperliquid|account|trading|trade|trades|funding|orders|fills|balance|margin|withdrawable)\b/.test(
    message,
  );
}
