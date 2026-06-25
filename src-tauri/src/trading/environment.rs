use serde::{Deserialize, Serialize};

use super::errors::{TradingError, TradingErrorCode};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HyperliquidEnvironment {
    Mainnet,
    Testnet,
}

impl HyperliquidEnvironment {
    pub fn from_input(value: &str) -> Result<Self, TradingError> {
        match value {
            "mainnet" => Ok(Self::Mainnet),
            "testnet" => Ok(Self::Testnet),
            _ => Err(TradingError::new(
                TradingErrorCode::UnsupportedEnvironment,
                "Choose Hyperliquid mainnet or testnet.",
                Some(format!("Unsupported Hyperliquid environment: {value}")),
                false,
            )),
        }
    }

    pub fn as_db(self) -> &'static str {
        match self {
            Self::Mainnet => "mainnet",
            Self::Testnet => "testnet",
        }
    }

    #[allow(dead_code)]
    pub fn official_base_url(self) -> &'static str {
        match self {
            Self::Mainnet => "https://api.hyperliquid.xyz",
            Self::Testnet => "https://api.hyperliquid-testnet.xyz",
        }
    }

    pub fn official_info_url(self) -> &'static str {
        match self {
            Self::Mainnet => "https://api.hyperliquid.xyz/info",
            Self::Testnet => "https://api.hyperliquid-testnet.xyz/info",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum HyperliquidReadCapability {
    Metadata,
    AllMids,
    ClearinghouseState,
    UserFills,
    UserFunding,
    OpenOrders,
}

impl HyperliquidReadCapability {
    #[allow(dead_code)]
    pub fn all() -> [Self; 6] {
        [
            Self::Metadata,
            Self::AllMids,
            Self::ClearinghouseState,
            Self::UserFills,
            Self::UserFunding,
            Self::OpenOrders,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_only_official_hosts() {
        assert_eq!(
            HyperliquidEnvironment::Mainnet.official_info_url(),
            "https://api.hyperliquid.xyz/info"
        );
        assert_eq!(
            HyperliquidEnvironment::Testnet.official_info_url(),
            "https://api.hyperliquid-testnet.xyz/info"
        );
    }

    #[test]
    fn rejects_unknown_environment_input() {
        assert!(HyperliquidEnvironment::from_input("https://evil.example").is_err());
        assert!(HyperliquidEnvironment::from_input("devnet").is_err());
    }

    #[test]
    fn exposes_read_capabilities_only() {
        let names = HyperliquidReadCapability::all()
            .into_iter()
            .map(|capability| format!("{capability:?}").to_lowercase())
            .collect::<Vec<_>>()
            .join(",");
        assert!(!names.contains("place"));
        assert!(!names.contains("modify"));
        assert!(!names.contains("cancel"));
        assert!(!names.contains("withdraw"));
        assert!(!names.contains("transfer"));
    }
}
