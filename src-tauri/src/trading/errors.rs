use serde::{Deserialize, Serialize};

use crate::storage::errors::StorageError;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TradingError {
    pub code: TradingErrorCode,
    pub user_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub technical_message: Option<String>,
    pub retryable: bool,
    pub provider: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TradingErrorCode {
    InvalidAddress,
    DuplicateAccount,
    UnsupportedEnvironment,
    ProviderUnavailable,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderHttpError,
    ProviderResponseTooLarge,
    ProviderMalformedResponse,
    ProviderMissingRequiredField,
    ProviderInvalidNumber,
    AccountNotFound,
    SyncAlreadyRunning,
    SyncCancelled,
    SyncPartial,
    DatabaseWriteFailed,
    DatabaseReadFailed,
    StaleAccountData,
    ResourceUnavailable,
    FixtureNotAvailable,
    InvalidRequest,
}

impl TradingError {
    pub fn new(
        code: TradingErrorCode,
        user_message: impl Into<String>,
        technical_message: Option<String>,
        retryable: bool,
    ) -> Self {
        Self {
            code,
            user_message: user_message.into(),
            technical_message,
            retryable,
            provider: "hyperliquid",
            resource: None,
        }
    }

    pub fn resource(mut self, resource: impl Into<String>) -> Self {
        self.resource = Some(resource.into());
        self
    }

    pub fn account_not_found() -> Self {
        Self::new(
            TradingErrorCode::AccountNotFound,
            "That Hyperliquid account could not be found.",
            None,
            false,
        )
    }

    pub fn invalid_request(detail: impl Into<String>) -> Self {
        Self::new(
            TradingErrorCode::InvalidRequest,
            "The trading request was invalid.",
            Some(detail.into()),
            false,
        )
    }

    pub fn from_storage_read(error: StorageError) -> Self {
        Self::new(
            TradingErrorCode::DatabaseReadFailed,
            "Trading Buddy could not read local trading data.",
            Some(error.to_string()),
            true,
        )
    }

    pub fn from_storage_write(error: StorageError) -> Self {
        Self::new(
            TradingErrorCode::DatabaseWriteFailed,
            "Trading Buddy could not save local trading data.",
            Some(error.to_string()),
            true,
        )
    }
}

impl From<rusqlite::Error> for TradingError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(
            TradingErrorCode::DatabaseReadFailed,
            "Trading Buddy could not read local trading data.",
            Some(error.to_string()),
            true,
        )
    }
}

impl std::fmt::Display for TradingError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.user_message)
    }
}

impl std::error::Error for TradingError {}
