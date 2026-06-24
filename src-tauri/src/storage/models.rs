use serde::{Deserialize, Serialize};

use super::errors::StorageError;

pub const MAX_TITLE_LENGTH: usize = 80;
pub const MAX_MESSAGE_CONTENT_LENGTH: usize = 120_000;
pub const MAX_MODEL_NAME_LENGTH: usize = 128;
pub const MAX_PAGE_LIMIT: u32 = 100;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConversationRetentionPolicy {
    KeepUntilDelete,
    DeleteAfter30Days,
    DeleteAfter90Days,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompanionPlacementMode {
    Free,
    DockLeft,
    DockRight,
    TaskbarPerch,
}

impl CompanionPlacementMode {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "free" => Ok(Self::Free),
            "dock_left" => Ok(Self::DockLeft),
            "dock_right" => Ok(Self::DockRight),
            "taskbar_perch" => Ok(Self::TaskbarPerch),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported companion placement mode: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::DockLeft => "dock_left",
            Self::DockRight => "dock_right",
            Self::TaskbarPerch => "taskbar_perch",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionPreferences {
    pub buddy_visible: bool,
    pub buddy_always_on_top: bool,
    pub placement_mode: CompanionPlacementMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_position: Option<CompanionFreePosition>,
    pub ambient_animations_enabled: bool,
    pub reduced_movement_enabled: bool,
    pub sleep_after_inactivity_seconds: u32,
    pub proactive_checkins_enabled: bool,
    pub proactive_checkin_cooldown_minutes: u32,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub do_not_disturb: bool,
    pub global_shortcut_enabled: bool,
    pub launch_at_login: bool,
    pub open_companion_home_at_startup: bool,
    pub bubble_width: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionFreePosition {
    pub x: i32,
    pub y: i32,
}

impl ConversationRetentionPolicy {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "keep_until_delete" => Ok(Self::KeepUntilDelete),
            "delete_after_30_days" => Ok(Self::DeleteAfter30Days),
            "delete_after_90_days" => Ok(Self::DeleteAfter90Days),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported retention policy: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::KeepUntilDelete => "keep_until_delete",
            Self::DeleteAfter30Days => "delete_after_30_days",
            Self::DeleteAfter90Days => "delete_after_90_days",
        }
    }

    pub fn max_age_days(&self) -> Option<i64> {
        match self {
            Self::KeepUntilDelete => None,
            Self::DeleteAfter30Days => Some(30),
            Self::DeleteAfter90Days => Some(90),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StoredMessageRole {
    User,
    Assistant,
}

impl StoredMessageRole {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "user" => Ok(Self::User),
            "assistant" => Ok(Self::Assistant),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported message role: {other}"
            ))),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StoredMessageStatus {
    Completed,
    Streaming,
    Cancelled,
    Failed,
    Interrupted,
}

impl StoredMessageStatus {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "completed" => Ok(Self::Completed),
            "streaming" => Ok(Self::Streaming),
            "cancelled" => Ok(Self::Cancelled),
            "failed" => Ok(Self::Failed),
            "interrupted" => Ok(Self::Interrupted),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported message status: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::Streaming => "streaming",
            Self::Cancelled => "cancelled",
            Self::Failed => "failed",
            Self::Interrupted => "interrupted",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageStatus {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<super::errors::StorageError>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostics {
    pub available: bool,
    pub database_file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_location_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<i64>,
    pub conversation_count: u32,
    pub active_conversation_count: u32,
    pub archived_conversation_count: u32,
    pub message_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_successful_retention_cleanup_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<super::errors::StorageError>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageMetadata {
    pub schema_version: i64,
    pub application_created_at: String,
    pub last_successful_migration_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_local_model: Option<String>,
    pub ambient_animations_enabled: bool,
    pub conversation_retention_policy: ConversationRetentionPolicy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_opened_conversation_id: Option<String>,
    pub companion_preferences: CompanionPreferences,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    pub message_count: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: StoredMessageRole,
    pub content: String,
    pub status: StoredMessageStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationDetail {
    pub conversation: ConversationSummary,
    pub messages: Vec<StoredMessage>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareGenerationRequest {
    pub conversation_id: Option<String>,
    pub request_id: String,
    pub user_content: String,
    pub model_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareGenerationResponse {
    pub conversation: ConversationSummary,
    pub user_message: StoredMessage,
    pub assistant_message: StoredMessage,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMessageUpdate {
    pub message_id: String,
    pub request_id: String,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMessageFailure {
    pub message_id: String,
    pub request_id: String,
    pub content: String,
    pub error_code: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RetentionCleanupResult {
    pub removed_conversations: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAllResult {
    pub deleted_conversations: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub exported_conversations: u32,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DevelopmentFixtureResult {
    pub conversation_id: String,
    pub assistant_message_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ConversationExportFile {
    pub format: String,
    pub version: u32,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub conversations: Vec<ConversationExport>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationExport {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
    pub messages: Vec<MessageExport>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MessageExport {
    pub id: String,
    pub role: StoredMessageRole,
    pub status: StoredMessageStatus,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}
