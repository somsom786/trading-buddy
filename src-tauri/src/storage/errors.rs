use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageError {
    pub code: StorageErrorCode,
    pub user_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub technical_message: Option<String>,
    pub retryable: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageErrorCode {
    DatabaseUnavailable,
    MigrationFailed,
    InvalidStoredData,
    ConversationNotFound,
    MessageNotFound,
    WriteFailed,
    ReadFailed,
    ExportFailed,
    DeletionFailed,
    RetentionCleanupFailed,
    InvalidFrontendRequest,
}

impl StorageError {
    pub fn database_unavailable(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::DatabaseUnavailable,
            "Trading Buddy could not open its local conversation database.",
            Some(detail.into()),
            true,
        )
    }

    pub fn migration_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::MigrationFailed,
            "Trading Buddy could not update its local database schema.",
            Some(detail.into()),
            true,
        )
    }

    pub fn invalid_stored_data(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::InvalidStoredData,
            "Trading Buddy found local conversation data it could not read safely.",
            Some(detail.into()),
            false,
        )
    }

    pub fn conversation_not_found() -> Self {
        Self::new(
            StorageErrorCode::ConversationNotFound,
            "That conversation could not be found.",
            None,
            false,
        )
    }

    pub fn message_not_found() -> Self {
        Self::new(
            StorageErrorCode::MessageNotFound,
            "That message could not be found.",
            None,
            false,
        )
    }

    pub fn write_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::WriteFailed,
            "Trading Buddy could not save the latest conversation changes.",
            Some(detail.into()),
            true,
        )
    }

    pub fn read_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::ReadFailed,
            "Trading Buddy could not read local conversations.",
            Some(detail.into()),
            true,
        )
    }

    pub fn export_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::ExportFailed,
            "Trading Buddy could not export conversations.",
            Some(detail.into()),
            true,
        )
    }

    pub fn deletion_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::DeletionFailed,
            "Trading Buddy could not delete the requested conversation data.",
            Some(detail.into()),
            true,
        )
    }

    pub fn retention_failed(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::RetentionCleanupFailed,
            "Trading Buddy could not complete local retention cleanup.",
            Some(detail.into()),
            true,
        )
    }

    pub fn invalid_request(detail: impl Into<String>) -> Self {
        Self::new(
            StorageErrorCode::InvalidFrontendRequest,
            "The storage request was invalid.",
            Some(detail.into()),
            false,
        )
    }

    pub fn from_sql_read(error: rusqlite::Error) -> Self {
        Self::read_failed(error.to_string())
    }

    pub fn from_sql_write(error: rusqlite::Error) -> Self {
        Self::write_failed(error.to_string())
    }

    fn new(
        code: StorageErrorCode,
        user_message: impl Into<String>,
        technical_message: Option<String>,
        retryable: bool,
    ) -> Self {
        Self {
            code,
            user_message: user_message.into(),
            technical_message,
            retryable,
        }
    }
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.user_message)
    }
}

impl std::error::Error for StorageError {}
