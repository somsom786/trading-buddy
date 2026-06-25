use chrono::Utc;

use super::{
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    models::NormalizedSyncData,
    responses::{parse_sync_data, RawSyncPayloads},
};

pub const SYNTHETIC_FIXTURE_ADDRESS: &str = "0xabcdefabcdef1234567890000000000000000000";

pub struct FixturePayloads {
    pub metadata: &'static str,
    pub all_mids: &'static str,
    pub account: &'static str,
    pub fills: &'static str,
    pub funding: &'static str,
    pub orders: &'static str,
}

pub fn scenario_names() -> Vec<&'static str> {
    vec![
        "empty_account",
        "single_long",
        "multiple_positions",
        "fills_and_funding",
        "duplicate_fills",
        "partial_failure",
        "provider_offline",
        "rate_limited",
        "malformed_response",
        "stale_account",
    ]
}

pub fn fixture_payloads(scenario: &str) -> Result<FixturePayloads, TradingError> {
    match scenario {
        "empty_account" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/account-empty.json"),
            fills: "[]",
            funding: "[]",
            orders: "[]",
        }),
        "single_long" | "fills_and_funding" | "stale_account" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/account-single-long.json"),
            fills: include_str!("../../tests/fixtures/hyperliquid/fills-normal.json"),
            funding: include_str!("../../tests/fixtures/hyperliquid/funding-normal.json"),
            orders: include_str!("../../tests/fixtures/hyperliquid/orders-normal.json"),
        }),
        "multiple_positions" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!(
                "../../tests/fixtures/hyperliquid/account-multiple-positions.json"
            ),
            fills: include_str!("../../tests/fixtures/hyperliquid/fills-normal.json"),
            funding: include_str!("../../tests/fixtures/hyperliquid/funding-normal.json"),
            orders: include_str!("../../tests/fixtures/hyperliquid/orders-normal.json"),
        }),
        "duplicate_fills" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/account-single-long.json"),
            fills: include_str!("../../tests/fixtures/hyperliquid/fills-duplicates.json"),
            funding: include_str!("../../tests/fixtures/hyperliquid/funding-normal.json"),
            orders: include_str!("../../tests/fixtures/hyperliquid/orders-normal.json"),
        }),
        "partial_failure" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/partial-missing-optional.json"),
            fills: include_str!("../../tests/fixtures/hyperliquid/fills-normal.json"),
            funding: include_str!("../../tests/fixtures/hyperliquid/funding-normal.json"),
            orders: include_str!("../../tests/fixtures/hyperliquid/orders-normal.json"),
        }),
        "provider_offline" => Err(TradingError::new(
            TradingErrorCode::ProviderUnavailable,
            "Hyperliquid is unavailable right now. Last saved data remains available.",
            Some("Fixture provider_offline scenario".to_owned()),
            true,
        )),
        "rate_limited" => Err(TradingError::new(
            TradingErrorCode::ProviderRateLimited,
            "Hyperliquid rate limited this read-only refresh. Please try again later.",
            Some(include_str!("../../tests/fixtures/hyperliquid/rate-limit-error.json").to_owned()),
            true,
        )),
        "malformed_response" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/malformed-number.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/account-single-long.json"),
            fills: include_str!("../../tests/fixtures/hyperliquid/fills-normal.json"),
            funding: include_str!("../../tests/fixtures/hyperliquid/funding-normal.json"),
            orders: include_str!("../../tests/fixtures/hyperliquid/orders-normal.json"),
        }),
        _ => Err(TradingError::new(
            TradingErrorCode::FixtureNotAvailable,
            "That Hyperliquid fixture scenario is not available.",
            Some(format!("Unknown fixture scenario: {scenario}")),
            false,
        )),
    }
}

pub fn fixture_sync_data(
    environment: HyperliquidEnvironment,
    normalized_address: &str,
    scenario: &str,
) -> Result<NormalizedSyncData, TradingError> {
    let payloads = fixture_payloads(scenario)?;
    parse_sync_data(
        environment,
        normalized_address,
        RawSyncPayloads {
            metadata_json: payloads.metadata,
            all_mids_json: payloads.all_mids,
            account_json: payloads.account,
            fills_json: payloads.fills,
            funding_json: payloads.funding,
            orders_json: payloads.orders,
        },
        Utc::now(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_scenarios_are_declared_and_parse() {
        assert!(scenario_names().contains(&"single_long"));
        let parsed = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            "single_long",
        )
        .unwrap();
        assert_eq!(parsed.positions.len(), 1);
    }

    #[test]
    fn malformed_fixture_fails_parser() {
        let parsed = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            "malformed_response",
        );
        assert!(parsed.is_err());
    }
}
