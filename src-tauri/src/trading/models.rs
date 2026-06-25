use serde::{Deserialize, Serialize};

use super::environment::HyperliquidEnvironment;

pub const PROVIDER: &str = "hyperliquid";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidAddressValidation {
    pub valid: bool,
    pub normalized_address: Option<String>,
    pub display_address: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateHyperliquidAccountRequest {
    pub environment: HyperliquidEnvironment,
    pub public_address: String,
    pub display_name: Option<String>,
    pub fixture_scenario: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationAccount {
    pub id: String,
    pub provider: String,
    pub environment: HyperliquidEnvironment,
    pub public_address: String,
    pub normalized_address: String,
    pub display_address: String,
    pub display_name: Option<String>,
    pub status: IntegrationAccountStatus,
    pub sync_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_sync_started_at: Option<String>,
    pub last_sync_completed_at: Option<String>,
    pub last_sync_error_code: Option<String>,
    pub last_successful_data_at: Option<String>,
    pub is_fixture: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IntegrationAccountStatus {
    Active,
    Paused,
    Error,
    Disconnected,
}

impl IntegrationAccountStatus {
    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Paused => "paused",
            Self::Error => "error",
            Self::Disconnected => "disconnected",
        }
    }

    pub fn from_db(value: &str) -> Self {
        match value {
            "paused" => Self::Paused,
            "error" => Self::Error,
            "disconnected" => Self::Disconnected,
            _ => Self::Active,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidAccountSummary {
    pub account: IntegrationAccount,
    pub account_value: Option<String>,
    pub total_margin_used: Option<String>,
    pub withdrawable: Option<String>,
    pub open_position_count: u32,
    pub fill_count: u32,
    pub funding_count: u32,
    pub open_order_count: u32,
    pub last_snapshot_at: Option<String>,
    pub freshness: TradingDataFreshness,
    pub partial_sync: bool,
    pub read_only: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "status")]
pub enum TradingDataFreshness {
    Fresh { age_seconds: i64 },
    Aging { age_seconds: i64 },
    Stale { age_seconds: i64 },
    Unknown,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidPosition {
    pub id: String,
    pub symbol: String,
    pub side: String,
    pub signed_size: String,
    pub absolute_size: String,
    pub entry_price: Option<String>,
    pub mark_price: Option<String>,
    pub notional: Option<String>,
    pub leverage_type: Option<String>,
    pub leverage_value: Option<String>,
    pub liquidation_price: Option<String>,
    pub margin_used: Option<String>,
    pub unrealized_pnl: Option<String>,
    pub return_on_equity: Option<String>,
    pub snapshot_timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidFill {
    pub id: String,
    pub symbol: String,
    pub side: String,
    pub direction: Option<String>,
    pub price: String,
    pub size: String,
    pub fee: String,
    pub fee_token: Option<String>,
    pub closed_pnl: Option<String>,
    pub fill_timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidFunding {
    pub id: String,
    pub symbol: String,
    pub amount: String,
    pub funding_rate: Option<String>,
    pub position_size: Option<String>,
    pub event_timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidOpenOrder {
    pub id: String,
    pub source_order_id: String,
    pub symbol: String,
    pub side: String,
    pub order_type: Option<String>,
    pub price: Option<String>,
    pub size: String,
    pub original_size: Option<String>,
    pub reduce_only: Option<bool>,
    pub trigger_price: Option<String>,
    pub order_timestamp: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidSyncResult {
    pub run_id: String,
    pub status: String,
    pub resources_completed: Vec<String>,
    pub error_code: Option<String>,
    pub records_inserted: u32,
    pub records_updated: u32,
    pub records_unchanged: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HyperliquidDiagnostics {
    pub account_count: u32,
    pub fixture_account_count: u32,
    pub position_count: u32,
    pub fill_count: u32,
    pub funding_count: u32,
    pub open_order_count: u32,
    pub latest_sync_status: Option<String>,
}

#[derive(Clone, Debug)]
pub struct NormalizedMetadata {
    pub asset_key: String,
    pub symbol: String,
    pub size_decimals: u32,
    pub max_leverage: Option<u32>,
    pub is_active: bool,
}

#[derive(Clone, Debug)]
pub struct NormalizedAccountSnapshot {
    pub account_value: Option<String>,
    pub total_margin_used: Option<String>,
    pub withdrawable: Option<String>,
    pub total_raw_usd: Option<String>,
    pub snapshot_timestamp: String,
}

#[derive(Clone, Debug)]
pub struct NormalizedPosition {
    pub asset_key: String,
    pub symbol: String,
    pub side: String,
    pub signed_size: String,
    pub absolute_size: String,
    pub entry_price: Option<String>,
    pub mark_price: Option<String>,
    pub notional: Option<String>,
    pub leverage_type: Option<String>,
    pub leverage_value: Option<String>,
    pub liquidation_price: Option<String>,
    pub margin_used: Option<String>,
    pub unrealized_pnl: Option<String>,
    pub return_on_equity: Option<String>,
    pub snapshot_timestamp: String,
}

#[derive(Clone, Debug)]
pub struct NormalizedFill {
    pub source_identity: String,
    pub source_transaction_hash: Option<String>,
    pub source_order_id: Option<String>,
    pub asset_key: String,
    pub symbol: String,
    pub side: String,
    pub direction: Option<String>,
    pub price: String,
    pub size: String,
    pub fee: String,
    pub fee_token: Option<String>,
    pub closed_pnl: Option<String>,
    pub fill_timestamp: String,
}

#[derive(Clone, Debug)]
pub struct NormalizedFunding {
    pub source_identity: String,
    pub asset_key: String,
    pub symbol: String,
    pub amount: String,
    pub funding_rate: Option<String>,
    pub position_size: Option<String>,
    pub event_timestamp: String,
}

#[derive(Clone, Debug)]
pub struct NormalizedOpenOrder {
    pub source_order_id: String,
    pub asset_key: String,
    pub symbol: String,
    pub side: String,
    pub order_type: Option<String>,
    pub price: Option<String>,
    pub size: String,
    pub original_size: Option<String>,
    pub reduce_only: Option<bool>,
    pub trigger_price: Option<String>,
    pub order_timestamp: Option<String>,
    pub snapshot_timestamp: String,
}

#[derive(Clone, Debug)]
pub struct NormalizedSyncData {
    pub metadata: Vec<NormalizedMetadata>,
    #[allow(dead_code)]
    pub mids: std::collections::BTreeMap<String, String>,
    pub account_snapshot: NormalizedAccountSnapshot,
    pub positions: Vec<NormalizedPosition>,
    pub fills: Vec<NormalizedFill>,
    pub funding: Vec<NormalizedFunding>,
    pub open_orders: Vec<NormalizedOpenOrder>,
}
