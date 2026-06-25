use chrono::Utc;

use super::{
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    models::{NormalizedFill, NormalizedFunding, NormalizedSyncData},
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
        "duplicate_heavy",
        "slow_sync",
        "cancel_during_fills",
        "performance_100_fills",
        "performance_1000_fills",
        "performance_10000_fills",
        "partial_failure",
        "provider_offline",
        "rate_limited",
        "malformed_response",
        "stale_account",
    ]
}

pub fn scenario_exists(scenario: &str) -> bool {
    scenario_names().contains(&scenario)
}

pub fn synthetic_fixture_address(scenario: &str) -> String {
    let mut hash = 0xabcdefabcdef12345678900000000000u128;
    for byte in scenario.as_bytes() {
        hash = hash
            .wrapping_mul(0x100000001b3)
            .wrapping_add(u128::from(*byte));
    }
    format!("0x{hash:040x}")
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
        "duplicate_fills" | "duplicate_heavy" => Ok(FixturePayloads {
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
        "slow_sync"
        | "cancel_during_fills"
        | "performance_100_fills"
        | "performance_1000_fills"
        | "performance_10000_fills" => Ok(FixturePayloads {
            metadata: include_str!("../../tests/fixtures/hyperliquid/metadata-normal.json"),
            all_mids: include_str!("../../tests/fixtures/hyperliquid/all-mids-normal.json"),
            account: include_str!("../../tests/fixtures/hyperliquid/account-single-long.json"),
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
    let mut data = parse_sync_data(
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
    )?;
    match scenario {
        "duplicate_heavy" => {
            data.fills = duplicate_fills(data.fills, 25, false);
            data.funding = duplicate_funding(data.funding, 25, false);
        }
        "performance_100_fills" => {
            data.fills = duplicate_fills(data.fills, 100, true);
        }
        "performance_1000_fills" => {
            data.fills = duplicate_fills(data.fills, 1_000, true);
        }
        "performance_10000_fills" => {
            data.fills = duplicate_fills(data.fills, 10_000, true);
        }
        _ => {}
    }
    Ok(data)
}

fn duplicate_fills(seed: Vec<NormalizedFill>, count: usize, unique: bool) -> Vec<NormalizedFill> {
    let Some(template) = seed.first().cloned() else {
        return seed;
    };
    (0..count)
        .map(|index| {
            let mut fill = template.clone();
            if unique {
                fill.source_identity = format!("fixture-fill-{index:05}");
                fill.fill_timestamp = format!(
                    "2025-01-{:02}T00:{:02}:00+00:00",
                    1 + index % 28,
                    index % 60
                );
            }
            fill
        })
        .collect()
}

fn duplicate_funding(
    seed: Vec<NormalizedFunding>,
    count: usize,
    unique: bool,
) -> Vec<NormalizedFunding> {
    let Some(template) = seed.first().cloned() else {
        return seed;
    };
    (0..count)
        .map(|index| {
            let mut funding = template.clone();
            if unique {
                funding.source_identity = format!("fixture-funding-{index:05}");
                funding.event_timestamp = format!(
                    "2025-01-{:02}T08:{:02}:00+00:00",
                    1 + index % 28,
                    index % 60
                );
            }
            funding
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_scenarios_are_declared_and_parse() {
        assert!(scenario_names().contains(&"single_long"));
        assert!(scenario_names().contains(&"slow_sync"));
        let parsed = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            "single_long",
        )
        .unwrap();
        assert_eq!(parsed.positions.len(), 1);
    }

    #[test]
    fn performance_fixture_expands_unique_fills() {
        let parsed = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            "performance_100_fills",
        )
        .unwrap();
        assert_eq!(parsed.fills.len(), 100);
        assert_eq!(parsed.fills[0].source_identity, "fixture-fill-00000");
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
