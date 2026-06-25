# Hyperliquid API Contract — Read-Only Foundation

Reviewed: 2026-06-25

Trading Buddy uses only official Hyperliquid read-only `info` APIs for this foundation. It does not
use the `exchange` endpoint, signing, API wallets, private keys, agent approval, wallet SDKs,
generic RPC, or WebSocket live sync.

## Official sources reviewed

- [Hyperliquid API overview](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)
- [Info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [Perpetuals info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)
- [Notation](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/notation)
- [Asset IDs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids)
- [Rate limits and user limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)
- [Error responses](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/error-responses)
- [WebSocket](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket) for
  future-work notes only.

## Environment mapping

Official docs state that examples use mainnet and equivalent requests may be made against testnet:

| Environment | Allowlisted base URL                  | Info endpoint                                   |
| ----------- | ------------------------------------- | ----------------------------------------------- |
| Mainnet     | `https://api.hyperliquid.xyz`         | `POST https://api.hyperliquid.xyz/info`         |
| Testnet     | `https://api.hyperliquid-testnet.xyz` | `POST https://api.hyperliquid-testnet.xyz/info` |

React must pass only the typed environment value `mainnet` or `testnet`. It must never pass an
arbitrary URL.

## User address

Official read-only user endpoints require an on-chain/public account address in 42-character
hexadecimal form such as `0x0000000000000000000000000000000000000000`.

Trading Buddy syntax validation is local-only:

- trim surrounding ASCII whitespace;
- require lowercase `0x` prefix after normalization;
- require exactly 40 hexadecimal characters after the prefix;
- reject non-ASCII and Unicode lookalike input;
- normalize to lowercase for duplicate detection.

## Request model

All used requests are JSON `POST` requests to the allowlisted `/info` endpoint with
`Content-Type: application/json`.

| Capability           | Request body                                                                                                       | Purpose                                              | Notes                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `Metadata`           | `{ "type": "meta" }`                                                                                               | Perpetual universe metadata                          | `dex` intentionally omitted for first perp dex.                         |
| `AllMids`            | `{ "type": "allMids" }`                                                                                            | Current mids for all coins                           | Docs note last trade price can be used if book is empty.                |
| `ClearinghouseState` | `{ "type": "clearinghouseState", "user": "<address>" }`                                                            | Perps account summary, open positions, margin fields | Uses the actual master/sub-account address, not agent wallet addresses. |
| `UserFills`          | `{ "type": "userFillsByTime", "user": "<address>", "startTime": <ms>, "endTime": <ms>, "aggregateByTime": false }` | Historical fills                                     | At most 2,000 per response; only 10,000 most recent fills available.    |
| `UserFunding`        | `{ "type": "userFunding", "user": "<address>", "startTime": <ms>, "endTime": <ms> }`                               | User funding history                                 | Time fields are milliseconds, inclusive.                                |
| `OpenOrders`         | `{ "type": "openOrders", "user": "<address>" }`                                                                    | Current open orders                                  | Perpetual and spot behavior depends on first perp dex defaults.         |

## Timestamps and history limits

- Official time inputs for `userFillsByTime`, `userFunding`, and `fundingHistory` are milliseconds.
- Time-range responses return only 500 elements or distinct blocks of data unless the endpoint has a
  more specific limit.
- `userFillsByTime` returns at most 2,000 fills per response and only the 10,000 most recent fills
  are available.
- Pagination must use the last returned timestamp as the next `startTime` when querying larger
  ranges. Trading Buddy’s first foundation bounds fixture and manual sync; it does not claim
  complete lifetime reconstruction.

## Numeric behavior

The docs use compact field names:

- `px` = price;
- `sz` = size in base coin units;
- `szi` = signed size, positive for long and negative for short;
- `ntl` = notional in USD;
- `side` uses `B` for bid/buy and `A` for ask/short.

Provider numeric values used for money, price, size, margin, PnL, fees, leverage, funding, and
account values are treated as decimal strings. Trading Buddy validates them in Rust and stores the
exact provider text representation in SQLite. React receives strings and performs display
formatting only.

Malformed decimal strings, `NaN`, `Infinity`, scientific notation, and overflowing values are
rejected by the parser rather than rounded or coerced.

## Response fields used

Unknown extra fields are tolerated. Missing required fields are rejected. Optional provider fields
remain optional and are shown as unavailable when absent.

### Metadata

- `universe[].name`
- `universe[].szDecimals`
- `universe[].maxLeverage` when present
- `universe[].isDelisted` when present

### Clearinghouse state

- `marginSummary.accountValue`
- `marginSummary.totalMarginUsed`
- `crossMarginSummary.accountValue`
- `crossMarginSummary.totalMarginUsed`
- `withdrawable`
- `assetPositions[].position.coin`
- `assetPositions[].position.szi`
- `assetPositions[].position.entryPx`
- `assetPositions[].position.positionValue`
- `assetPositions[].position.unrealizedPnl`
- `assetPositions[].position.returnOnEquity`
- `assetPositions[].position.liquidationPx`
- `assetPositions[].position.marginUsed`
- `assetPositions[].position.leverage.type`
- `assetPositions[].position.leverage.value`
- `assetPositions[].position.leverage.rawUsd`

### Fills

- `coin`
- `px`
- `sz`
- `side`
- `time`
- `startPosition`
- `dir`
- `closedPnl`
- `hash`
- `oid`
- `crossed`
- `fee`
- `tid`
- `feeToken`

Fill source identity is deterministic and includes environment, normalized address, `coin`, `time`,
`hash`, `oid`, `tid`, `side`, `px`, and `sz`.

### Funding

- `delta.coin`
- `delta.usdc`
- `delta.szi`
- `delta.fundingRate`
- `hash`
- `time`

Funding source identity is deterministic and includes environment, normalized address, `coin`,
`time`, `hash`, `usdc`, `szi`, and `fundingRate`.

### Open orders

- `coin`
- `side`
- `limitPx`
- `sz`
- `oid`
- `timestamp`
- `reduceOnly`
- `origSz` when present
- `orderType` when present
- `triggerPx` when present

## Rate limits

Official docs state REST requests share an IP-based aggregated weight limit of 1,200 per minute.
`allMids` and `clearinghouseState` have weight 2. Most other documented `info` requests have
weight 20, and selected history endpoints including `userFillsByTime` and `userFunding` add weight
per 20 items returned.

Trading Buddy uses bounded manual sync, bounded retries for safe transient failures, and fixture
sync for development. It does not poll continuously.

## Error behavior

The official error page focuses mainly on action/order errors, which Trading Buddy does not use.
For read-only requests, Trading Buddy classifies transport and provider problems locally:

- provider unavailable;
- provider rate limited;
- provider timeout;
- HTTP error;
- oversized response;
- malformed response;
- missing required field;
- invalid decimal number.

Raw provider bodies are not displayed in normal UI.

## WebSocket future note

Official docs provide WebSocket URLs for mainnet and testnet, but Task 9B does not implement
WebSocket live sync. The foundation is REST-only and manually refreshed.

## Intentionally ignored

- `exchange` endpoint and all signed/write actions;
- non-funding ledger updates because they include deposits, transfers, and withdrawals and are not
  needed for the first read-only trading view;
- spot balances and spot metadata, except where open-order/fill docs mention spot behavior;
- WebSocket subscriptions;
- order status lookup;
- risk rules, recommendations, and analytics.
