use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Deserialize;

use super::{
    decimal::{absolute_decimal, decimal_side, validate_decimal_string, validate_optional_decimal},
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    models::{
        NormalizedAccountSnapshot, NormalizedFill, NormalizedFunding, NormalizedMetadata,
        NormalizedOpenOrder, NormalizedPosition, NormalizedSyncData,
    },
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaResponse {
    pub universe: Vec<MetaAssetDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaAssetDto {
    pub name: String,
    pub sz_decimals: u32,
    pub max_leverage: Option<u32>,
    pub is_delisted: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearinghouseStateDto {
    pub margin_summary: Option<MarginSummaryDto>,
    pub cross_margin_summary: Option<MarginSummaryDto>,
    pub withdrawable: Option<String>,
    pub asset_positions: Vec<AssetPositionDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarginSummaryDto {
    pub account_value: Option<String>,
    pub total_margin_used: Option<String>,
    pub total_raw_usd: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetPositionDto {
    pub position: PositionDto,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionDto {
    pub coin: String,
    pub szi: String,
    pub entry_px: Option<String>,
    pub position_value: Option<String>,
    pub unrealized_pnl: Option<String>,
    pub return_on_equity: Option<String>,
    pub liquidation_px: Option<String>,
    pub margin_used: Option<String>,
    pub leverage: Option<LeverageDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeverageDto {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub value: Option<u32>,
    pub raw_usd: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FillDto {
    pub coin: String,
    pub px: String,
    pub sz: String,
    pub side: String,
    pub time: i64,
    #[serde(rename = "startPosition")]
    #[allow(dead_code)]
    pub start_position: Option<String>,
    pub dir: Option<String>,
    #[serde(rename = "closedPnl")]
    pub closed_pnl: Option<String>,
    pub hash: Option<String>,
    pub oid: Option<serde_json::Value>,
    pub fee: String,
    #[serde(rename = "feeToken")]
    pub fee_token: Option<String>,
    pub tid: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct FundingDto {
    pub delta: FundingDeltaDto,
    pub hash: Option<String>,
    pub time: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FundingDeltaDto {
    pub coin: String,
    pub usdc: String,
    pub szi: Option<String>,
    pub funding_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOrderDto {
    pub coin: String,
    pub side: String,
    pub limit_px: String,
    pub sz: String,
    pub oid: serde_json::Value,
    pub timestamp: Option<i64>,
    pub reduce_only: Option<bool>,
    pub orig_sz: Option<String>,
    pub order_type: Option<String>,
    pub trigger_px: Option<String>,
}

pub struct RawSyncPayloads<'a> {
    pub metadata_json: &'a str,
    pub all_mids_json: &'a str,
    pub account_json: &'a str,
    pub fills_json: &'a str,
    pub funding_json: &'a str,
    pub orders_json: &'a str,
}

pub fn parse_sync_data(
    environment: HyperliquidEnvironment,
    normalized_address: &str,
    payloads: RawSyncPayloads<'_>,
    received_at: DateTime<Utc>,
) -> Result<NormalizedSyncData, TradingError> {
    let metadata: MetaResponse = from_json(payloads.metadata_json, "metadata")?;
    let mids: BTreeMap<String, String> = from_json(payloads.all_mids_json, "all_mids")?;
    let account: ClearinghouseStateDto = from_json(payloads.account_json, "account_state")?;
    let fills: Vec<FillDto> = from_json(payloads.fills_json, "fills")?;
    let funding: Vec<FundingDto> = from_json(payloads.funding_json, "funding")?;
    let orders: Vec<OpenOrderDto> = from_json(payloads.orders_json, "open_orders")?;

    let received_at = received_at.to_rfc3339();
    let metadata = metadata
        .universe
        .into_iter()
        .map(|asset| NormalizedMetadata {
            asset_key: asset.name.to_ascii_uppercase(),
            symbol: asset.name.clone(),
            size_decimals: asset.sz_decimals,
            max_leverage: asset.max_leverage,
            is_active: !asset.is_delisted.unwrap_or(false),
        })
        .collect::<Vec<_>>();
    let mids = normalize_mids(mids)?;
    let account_snapshot = normalize_account_snapshot(&account, &received_at)?;
    let positions = normalize_positions(&account, &mids, &received_at)?;
    let fills = normalize_fills(environment, normalized_address, fills)?;
    let funding = normalize_funding(environment, normalized_address, funding)?;
    let open_orders = normalize_orders(orders, &received_at)?;

    Ok(NormalizedSyncData {
        metadata,
        mids,
        account_snapshot,
        positions,
        fills,
        funding,
        open_orders,
    })
}

fn from_json<T: for<'de> Deserialize<'de>>(json: &str, resource: &str) -> Result<T, TradingError> {
    serde_json::from_str(json).map_err(|error| {
        TradingError::new(
            TradingErrorCode::ProviderMalformedResponse,
            "Hyperliquid returned data Trading Buddy could not parse safely.",
            Some(error.to_string()),
            false,
        )
        .resource(resource)
    })
}

fn normalize_mids(
    mids: BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>, TradingError> {
    mids.into_iter()
        .map(|(symbol, value)| {
            let decimal = validate_decimal_string(&value, "allMids")?;
            Ok((symbol.to_ascii_uppercase(), decimal))
        })
        .collect()
}

fn normalize_account_snapshot(
    account: &ClearinghouseStateDto,
    received_at: &str,
) -> Result<NormalizedAccountSnapshot, TradingError> {
    let summary = account
        .margin_summary
        .as_ref()
        .or(account.cross_margin_summary.as_ref());
    let account_value = summary
        .and_then(|summary| summary.account_value.as_deref())
        .map(|value| validate_decimal_string(value, "accountValue"))
        .transpose()?;
    let total_margin_used = summary
        .and_then(|summary| summary.total_margin_used.as_deref())
        .map(|value| validate_decimal_string(value, "totalMarginUsed"))
        .transpose()?;
    let total_raw_usd = summary
        .and_then(|summary| summary.total_raw_usd.as_deref())
        .map(|value| validate_decimal_string(value, "totalRawUsd"))
        .transpose()?;
    Ok(NormalizedAccountSnapshot {
        account_value,
        total_margin_used,
        withdrawable: validate_optional_decimal(account.withdrawable.as_deref(), "withdrawable")?,
        total_raw_usd,
        snapshot_timestamp: received_at.to_owned(),
    })
}

fn normalize_positions(
    account: &ClearinghouseStateDto,
    mids: &BTreeMap<String, String>,
    received_at: &str,
) -> Result<Vec<NormalizedPosition>, TradingError> {
    account
        .asset_positions
        .iter()
        .map(|asset| {
            let position = &asset.position;
            let signed_size = validate_decimal_string(&position.szi, "position.szi")?;
            let symbol = position.coin.to_ascii_uppercase();
            let leverage_value = position.leverage.as_ref().and_then(|leverage| {
                leverage
                    .value
                    .map(|value| value.to_string())
                    .or_else(|| leverage.raw_usd.as_deref().map(|value| value.to_owned()))
            });
            if let Some(raw_usd) = position
                .leverage
                .as_ref()
                .and_then(|leverage| leverage.raw_usd.as_deref())
            {
                let _ = validate_decimal_string(raw_usd, "leverage.rawUsd")?;
            }
            Ok(NormalizedPosition {
                asset_key: symbol.clone(),
                symbol: symbol.clone(),
                side: decimal_side(&signed_size).to_owned(),
                signed_size: signed_size.clone(),
                absolute_size: absolute_decimal(&signed_size),
                entry_price: validate_optional_decimal(position.entry_px.as_deref(), "entryPx")?,
                mark_price: mids.get(&symbol).cloned(),
                notional: validate_optional_decimal(
                    position.position_value.as_deref(),
                    "positionValue",
                )?,
                leverage_type: position
                    .leverage
                    .as_ref()
                    .and_then(|leverage| leverage.kind.clone()),
                leverage_value,
                liquidation_price: validate_optional_decimal(
                    position.liquidation_px.as_deref(),
                    "liquidationPx",
                )?,
                margin_used: validate_optional_decimal(
                    position.margin_used.as_deref(),
                    "marginUsed",
                )?,
                unrealized_pnl: validate_optional_decimal(
                    position.unrealized_pnl.as_deref(),
                    "unrealizedPnl",
                )?,
                return_on_equity: validate_optional_decimal(
                    position.return_on_equity.as_deref(),
                    "returnOnEquity",
                )?,
                snapshot_timestamp: received_at.to_owned(),
            })
        })
        .collect()
}

fn normalize_fills(
    environment: HyperliquidEnvironment,
    normalized_address: &str,
    fills: Vec<FillDto>,
) -> Result<Vec<NormalizedFill>, TradingError> {
    fills
        .into_iter()
        .map(|fill| {
            let symbol = fill.coin.to_ascii_uppercase();
            let price = validate_decimal_string(&fill.px, "fill.px")?;
            let size = validate_decimal_string(&fill.sz, "fill.sz")?;
            let fee = validate_decimal_string(&fill.fee, "fill.fee")?;
            let closed_pnl =
                validate_optional_decimal(fill.closed_pnl.as_deref(), "fill.closedPnl")?;
            let fill_timestamp = timestamp_ms(fill.time, "fill.time")?;
            let source_order_id = fill.oid.as_ref().map(json_identity);
            let tid = fill.tid.as_ref().map(json_identity).unwrap_or_default();
            let hash = fill.hash.clone().unwrap_or_default();
            let identity = stable_identity(&[
                environment.as_db(),
                normalized_address,
                &symbol,
                &fill.time.to_string(),
                &hash,
                source_order_id.as_deref().unwrap_or_default(),
                &tid,
                &fill.side,
                &price,
                &size,
            ]);
            Ok(NormalizedFill {
                source_identity: identity,
                source_transaction_hash: fill.hash,
                source_order_id,
                asset_key: symbol.clone(),
                symbol,
                side: fill.side,
                direction: fill.dir,
                price,
                size,
                fee,
                fee_token: fill.fee_token.map(|token| token.trim().to_owned()),
                closed_pnl,
                fill_timestamp,
            })
        })
        .collect()
}

fn normalize_funding(
    environment: HyperliquidEnvironment,
    normalized_address: &str,
    funding: Vec<FundingDto>,
) -> Result<Vec<NormalizedFunding>, TradingError> {
    funding
        .into_iter()
        .map(|funding| {
            let symbol = funding.delta.coin.to_ascii_uppercase();
            let amount = validate_decimal_string(&funding.delta.usdc, "funding.usdc")?;
            let funding_rate =
                validate_optional_decimal(funding.delta.funding_rate.as_deref(), "fundingRate")?;
            let position_size =
                validate_optional_decimal(funding.delta.szi.as_deref(), "funding.szi")?;
            let event_timestamp = timestamp_ms(funding.time, "funding.time")?;
            let hash = funding.hash.clone().unwrap_or_default();
            let identity = stable_identity(&[
                environment.as_db(),
                normalized_address,
                &symbol,
                &funding.time.to_string(),
                &hash,
                &amount,
                position_size.as_deref().unwrap_or_default(),
                funding_rate.as_deref().unwrap_or_default(),
            ]);
            Ok(NormalizedFunding {
                source_identity: identity,
                asset_key: symbol.clone(),
                symbol,
                amount,
                funding_rate,
                position_size,
                event_timestamp,
            })
        })
        .collect()
}

fn normalize_orders(
    orders: Vec<OpenOrderDto>,
    received_at: &str,
) -> Result<Vec<NormalizedOpenOrder>, TradingError> {
    orders
        .into_iter()
        .map(|order| {
            let symbol = order.coin.to_ascii_uppercase();
            Ok(NormalizedOpenOrder {
                source_order_id: json_identity(&order.oid),
                asset_key: symbol.clone(),
                symbol,
                side: order.side,
                order_type: order.order_type,
                price: validate_optional_decimal(Some(&order.limit_px), "order.limitPx")?,
                size: validate_decimal_string(&order.sz, "order.sz")?,
                original_size: validate_optional_decimal(order.orig_sz.as_deref(), "order.origSz")?,
                reduce_only: order.reduce_only,
                trigger_price: validate_optional_decimal(
                    order.trigger_px.as_deref(),
                    "order.triggerPx",
                )?,
                order_timestamp: order
                    .timestamp
                    .map(|timestamp| timestamp_ms(timestamp, "order.timestamp"))
                    .transpose()?,
                snapshot_timestamp: received_at.to_owned(),
            })
        })
        .collect()
}

fn timestamp_ms(value: i64, field: &str) -> Result<String, TradingError> {
    DateTime::<Utc>::from_timestamp_millis(value)
        .map(|timestamp| timestamp.to_rfc3339())
        .ok_or_else(|| {
            TradingError::new(
                TradingErrorCode::ProviderMalformedResponse,
                "Hyperliquid returned a timestamp Trading Buddy could not read safely.",
                Some(format!(
                    "Invalid millisecond timestamp for {field}: {value}"
                )),
                false,
            )
        })
}

fn json_identity(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Number(value) => value.to_string(),
        other => other.to_string(),
    }
}

fn stable_identity(parts: &[&str]) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for part in parts {
        for byte in part.as_bytes().iter().chain([0xff].iter()) {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    }
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const ADDRESS: &str = "0xabcdefabcdef1234567890000000000000000000";

    #[test]
    fn parses_synthetic_provider_payloads() {
        let data = parse_sync_data(
            HyperliquidEnvironment::Testnet,
            ADDRESS,
            RawSyncPayloads {
                metadata_json: r#"{"universe":[{"name":"ETH","szDecimals":4,"maxLeverage":50}]}"#,
                all_mids_json: r#"{"ETH":"3000.25"}"#,
                account_json: r#"{"marginSummary":{"accountValue":"1000.50","totalMarginUsed":"50.25","totalRawUsd":"1000.50"},"withdrawable":"950.25","assetPositions":[{"position":{"coin":"ETH","szi":"0.5","entryPx":"2900","positionValue":"1500.125","unrealizedPnl":"10.5","returnOnEquity":"0.01","liquidationPx":"2100","marginUsed":"50","leverage":{"type":"cross","value":10}}}]}"#,
                fills_json: r#"[{"coin":"ETH","px":"3000","sz":"0.1","side":"B","time":1700000000000,"dir":"Open Long","closedPnl":"0","hash":"0xaaa","oid":1,"fee":"0.1","feeToken":"USDC","tid":2}]"#,
                funding_json: r#"[{"delta":{"coin":"ETH","usdc":"-0.02","szi":"0.5","fundingRate":"0.0001"},"hash":"0xbbb","time":1700003600000}]"#,
                orders_json: r#"[{"coin":"ETH","side":"A","limitPx":"3500","sz":"0.1","oid":3,"timestamp":1700007200000,"reduceOnly":true,"origSz":"0.1","orderType":"Limit"}]"#,
            },
            Utc::now(),
        )
        .unwrap();
        assert_eq!(data.metadata[0].symbol, "ETH");
        assert_eq!(data.positions[0].mark_price.as_deref(), Some("3000.25"));
        assert_eq!(data.fills.len(), 1);
        assert_eq!(data.funding.len(), 1);
        assert_eq!(data.open_orders.len(), 1);
    }

    #[test]
    fn rejects_bad_numbers_and_timestamps() {
        let result = parse_sync_data(
            HyperliquidEnvironment::Testnet,
            ADDRESS,
            RawSyncPayloads {
                metadata_json: r#"{"universe":[{"name":"ETH","szDecimals":4}]}"#,
                all_mids_json: r#"{"ETH":"3e3"}"#,
                account_json: r#"{"marginSummary":{"accountValue":"1000"},"assetPositions":[]}"#,
                fills_json: "[]",
                funding_json: "[]",
                orders_json: "[]",
            },
            Utc::now(),
        );
        assert!(result.is_err());
    }
}
