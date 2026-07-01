use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use reqwest::StatusCode;
use serde_json::json;
use tokio::time::sleep;

use super::{
    coordinator::ActiveHyperliquidSync,
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    fixtures::fixture_sync_data,
    models::{IntegrationAccount, NormalizedSyncData},
    responses::{parse_sync_data, RawSyncPayloads},
};

const MAX_RESPONSE_BYTES: usize = 2_000_000;

pub async fn fetch_sync_data(
    account: &IntegrationAccount,
    active_sync: Option<&ActiveHyperliquidSync>,
) -> Result<NormalizedSyncData, TradingError> {
    if account.is_fixture {
        if let Some(active_sync) = active_sync {
            active_sync.check_cancelled("fixture")?;
            fetch_fixture_with_progress(account, active_sync).await
        } else {
            fixture_sync_data(
                account.environment,
                &account.normalized_address,
                account
                    .fixture_scenario
                    .as_deref()
                    .or(account.display_name.as_deref())
                    .unwrap_or("single_long"),
            )
        }
    } else {
        OfficialHyperliquidTransport::new(account.environment)?
            .fetch(account, active_sync)
            .await
    }
}

async fn fetch_fixture_with_progress(
    account: &IntegrationAccount,
    active_sync: &ActiveHyperliquidSync,
) -> Result<NormalizedSyncData, TradingError> {
    let scenario = account
        .fixture_scenario
        .as_deref()
        .or(account.display_name.as_deref())
        .unwrap_or("single_long");
    for resource in [
        "metadata",
        "account_state",
        "positions",
        "fills",
        "funding",
        "open_orders",
    ] {
        active_sync.set_current_resource(resource)?;
        if scenario == "slow_sync" || scenario == "cancel_during_fills" {
            sleep(Duration::from_millis(180)).await;
        }
        active_sync.check_cancelled(resource)?;
        active_sync.complete_resource(resource)?;
        if scenario == "cancel_during_fills" && resource == "metadata" {
            sleep(Duration::from_millis(240)).await;
        }
    }
    if scenario == "slow_sync" || scenario == "cancel_during_fills" {
        active_sync.check_cancelled("parse")?;
    }
    fixture_sync_data(account.environment, &account.normalized_address, scenario)
}

struct OfficialHyperliquidTransport {
    environment: HyperliquidEnvironment,
    client: reqwest::Client,
}

impl OfficialHyperliquidTransport {
    fn new(environment: HyperliquidEnvironment) -> Result<Self, TradingError> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(20))
            .user_agent("Trading Buddy BETA v0.3 read-only Hyperliquid sync")
            .build()
            .map_err(|error| {
                TradingError::new(
                    TradingErrorCode::ProviderUnavailable,
                    "Trading Buddy could not prepare the Hyperliquid read-only client.",
                    Some(error.to_string()),
                    true,
                )
            })?;
        Ok(Self {
            environment,
            client,
        })
    }

    async fn fetch(
        &self,
        account: &IntegrationAccount,
        active_sync: Option<&ActiveHyperliquidSync>,
    ) -> Result<NormalizedSyncData, TradingError> {
        let now = Utc::now();
        let start = (now - ChronoDuration::days(30)).timestamp_millis();
        let end = now.timestamp_millis();
        maybe_current(active_sync, "metadata")?;
        let metadata = self.post(json!({ "type": "meta" }), "metadata").await?;
        maybe_complete(active_sync, "metadata")?;
        maybe_current(active_sync, "all_mids")?;
        let all_mids = self.post(json!({ "type": "allMids" }), "all_mids").await?;
        maybe_complete(active_sync, "all_mids")?;
        maybe_current(active_sync, "account_state")?;
        let account_state = self
            .post(
                json!({
                    "type": "clearinghouseState",
                    "user": account.normalized_address,
                }),
                "account_state",
            )
            .await?;
        maybe_complete(active_sync, "account_state")?;
        maybe_current(active_sync, "fills")?;
        let fills = self
            .post(
                json!({
                    "type": "userFillsByTime",
                    "user": account.normalized_address,
                    "startTime": start,
                    "endTime": end,
                    "aggregateByTime": false,
                }),
                "fills",
            )
            .await?;
        maybe_complete(active_sync, "fills")?;
        maybe_current(active_sync, "funding")?;
        let funding = self
            .post(
                json!({
                    "type": "userFunding",
                    "user": account.normalized_address,
                    "startTime": start,
                    "endTime": end,
                }),
                "funding",
            )
            .await?;
        maybe_complete(active_sync, "funding")?;
        maybe_current(active_sync, "open_orders")?;
        let orders = self
            .post(
                json!({
                    "type": "openOrders",
                    "user": account.normalized_address,
                }),
                "open_orders",
            )
            .await?;
        maybe_complete(active_sync, "open_orders")?;
        parse_sync_data(
            self.environment,
            &account.normalized_address,
            RawSyncPayloads {
                metadata_json: &metadata,
                all_mids_json: &all_mids,
                account_json: &account_state,
                fills_json: &fills,
                funding_json: &funding,
                orders_json: &orders,
            },
            now,
        )
    }

    async fn post(
        &self,
        payload: serde_json::Value,
        resource: &str,
    ) -> Result<String, TradingError> {
        let response = self
            .client
            .post(self.environment.official_info_url())
            .json(&payload)
            .send()
            .await
            .map_err(|error| {
                if error.is_timeout() {
                    TradingError::new(
                        TradingErrorCode::ProviderTimeout,
                        "Hyperliquid did not answer before the read-only refresh timed out.",
                        Some(error.to_string()),
                        true,
                    )
                    .resource(resource)
                } else {
                    TradingError::new(
                        TradingErrorCode::ProviderUnavailable,
                        "Hyperliquid is unavailable right now. Last saved data remains available.",
                        Some(error.to_string()),
                        true,
                    )
                    .resource(resource)
                }
            })?;
        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(TradingError::new(
                TradingErrorCode::ProviderRateLimited,
                "Hyperliquid rate limited this read-only refresh. Please try again later.",
                Some("HTTP 429".to_owned()),
                true,
            )
            .resource(resource));
        }
        if !status.is_success() {
            return Err(TradingError::new(
                TradingErrorCode::ProviderHttpError,
                "Hyperliquid returned an HTTP error. Last saved data remains available.",
                Some(format!("HTTP {status}")),
                true,
            )
            .resource(resource));
        }
        let bytes = response.bytes().await.map_err(|error| {
            TradingError::new(
                TradingErrorCode::ProviderUnavailable,
                "Trading Buddy could not read the Hyperliquid response.",
                Some(error.to_string()),
                true,
            )
            .resource(resource)
        })?;
        if bytes.len() > MAX_RESPONSE_BYTES {
            return Err(TradingError::new(
                TradingErrorCode::ProviderResponseTooLarge,
                "Hyperliquid returned more data than Trading Buddy will process at once.",
                Some(format!("{} bytes", bytes.len())),
                false,
            )
            .resource(resource));
        }
        String::from_utf8(bytes.to_vec()).map_err(|error| {
            TradingError::new(
                TradingErrorCode::ProviderMalformedResponse,
                "Hyperliquid returned non-UTF-8 data.",
                Some(error.to_string()),
                false,
            )
            .resource(resource)
        })
    }
}

fn maybe_current(
    active_sync: Option<&ActiveHyperliquidSync>,
    resource: &str,
) -> Result<(), TradingError> {
    if let Some(active_sync) = active_sync {
        active_sync.check_cancelled(resource)?;
        active_sync.set_current_resource(resource)?;
    }
    Ok(())
}

fn maybe_complete(
    active_sync: Option<&ActiveHyperliquidSync>,
    resource: &str,
) -> Result<(), TradingError> {
    if let Some(active_sync) = active_sync {
        active_sync.check_cancelled(resource)?;
        active_sync.complete_resource(resource)?;
    }
    Ok(())
}
