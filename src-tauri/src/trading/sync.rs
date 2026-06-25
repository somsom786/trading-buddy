use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use reqwest::StatusCode;
use serde_json::json;

use super::{
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    fixtures::fixture_sync_data,
    models::{IntegrationAccount, NormalizedSyncData},
    responses::{parse_sync_data, RawSyncPayloads},
};

const MAX_RESPONSE_BYTES: usize = 2_000_000;

pub async fn fetch_sync_data(
    account: &IntegrationAccount,
) -> Result<NormalizedSyncData, TradingError> {
    if account.is_fixture {
        return fixture_sync_data(
            account.environment,
            &account.normalized_address,
            account.display_name.as_deref().unwrap_or("single_long"),
        );
    }
    OfficialHyperliquidTransport::new(account.environment)?
        .fetch(account)
        .await
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
            .user_agent("Trading Buddy BETA v0.2 read-only Hyperliquid sync")
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
    ) -> Result<NormalizedSyncData, TradingError> {
        let now = Utc::now();
        let start = (now - ChronoDuration::days(30)).timestamp_millis();
        let end = now.timestamp_millis();
        let metadata = self.post(json!({ "type": "meta" }), "metadata").await?;
        let all_mids = self.post(json!({ "type": "allMids" }), "all_mids").await?;
        let account_state = self
            .post(
                json!({
                    "type": "clearinghouseState",
                    "user": account.normalized_address,
                }),
                "account_state",
            )
            .await?;
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
        let orders = self
            .post(
                json!({
                    "type": "openOrders",
                    "user": account.normalized_address,
                }),
                "open_orders",
            )
            .await?;
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
