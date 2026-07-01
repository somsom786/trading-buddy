use serde::{Deserialize, Serialize};

use super::errors::StorageError;

pub const MAX_TITLE_LENGTH: usize = 80;
pub const MAX_MESSAGE_CONTENT_LENGTH: usize = 120_000;
pub const MAX_MODEL_NAME_LENGTH: usize = 128;
pub const MAX_PAGE_LIMIT: u32 = 100;
pub const MAX_MEMORY_CONTENT_LENGTH: usize = 600;
pub const MAX_MEMORY_SEARCH_LENGTH: usize = 200;
pub const MAX_JOURNAL_BODY_LENGTH: usize = 20_000;
pub const MAX_JOURNAL_TITLE_LENGTH: usize = 120;
pub const MAX_JOURNAL_SUMMARY_LENGTH: usize = 1_000;
pub const MAX_JOURNAL_TAG_LENGTH: usize = 32;
pub const MAX_JOURNAL_TAGS: usize = 12;
pub const MAX_JOURNAL_SEARCH_LENGTH: usize = 200;

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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MovementIntensity {
    Low,
    Medium,
    Lively,
}

impl MovementIntensity {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "lively" => Ok(Self::Lively),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported movement intensity: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::Lively => "lively",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryCategory {
    Preference,
    Goal,
    PersonalRule,
    CommunicationStyle,
    Routine,
    Project,
    TradingProfile,
    RiskRule,
    EmotionalTrigger,
    ImportantContext,
    TemporaryContext,
    Other,
}

impl MemoryCategory {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "preference" => Ok(Self::Preference),
            "goal" => Ok(Self::Goal),
            "personal_rule" => Ok(Self::PersonalRule),
            "communication_style" => Ok(Self::CommunicationStyle),
            "routine" => Ok(Self::Routine),
            "project" => Ok(Self::Project),
            "trading_profile" => Ok(Self::TradingProfile),
            "risk_rule" => Ok(Self::RiskRule),
            "emotional_trigger" => Ok(Self::EmotionalTrigger),
            "important_context" => Ok(Self::ImportantContext),
            "temporary_context" => Ok(Self::TemporaryContext),
            "other" => Ok(Self::Other),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported memory category: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Preference => "preference",
            Self::Goal => "goal",
            Self::PersonalRule => "personal_rule",
            Self::CommunicationStyle => "communication_style",
            Self::Routine => "routine",
            Self::Project => "project",
            Self::TradingProfile => "trading_profile",
            Self::RiskRule => "risk_rule",
            Self::EmotionalTrigger => "emotional_trigger",
            Self::ImportantContext => "important_context",
            Self::TemporaryContext => "temporary_context",
            Self::Other => "other",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryStatus {
    Proposed,
    Confirmed,
    Rejected,
    Expired,
    Superseded,
}

impl MemoryStatus {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "proposed" => Ok(Self::Proposed),
            "confirmed" => Ok(Self::Confirmed),
            "rejected" => Ok(Self::Rejected),
            "expired" => Ok(Self::Expired),
            "superseded" => Ok(Self::Superseded),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported memory status: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Proposed => "proposed",
            Self::Confirmed => "confirmed",
            Self::Rejected => "rejected",
            Self::Expired => "expired",
            Self::Superseded => "superseded",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemorySourceKind {
    UserExplicit,
    ModelProposed,
    UserCreated,
    SystemObservation,
}

impl MemorySourceKind {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "user_explicit" => Ok(Self::UserExplicit),
            "model_proposed" => Ok(Self::ModelProposed),
            "user_created" => Ok(Self::UserCreated),
            "system_observation" => Ok(Self::SystemObservation),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported memory source kind: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::UserExplicit => "user_explicit",
            Self::ModelProposed => "model_proposed",
            Self::UserCreated => "user_created",
            Self::SystemObservation => "system_observation",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemorySensitivity {
    Ordinary,
    Personal,
    Sensitive,
    Prohibited,
}

impl MemorySensitivity {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "ordinary" => Ok(Self::Ordinary),
            "personal" => Ok(Self::Personal),
            "sensitive" => Ok(Self::Sensitive),
            "prohibited" => Ok(Self::Prohibited),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported memory sensitivity: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Ordinary => "ordinary",
            Self::Personal => "personal",
            Self::Sensitive => "sensitive",
            Self::Prohibited => "prohibited",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryApprovalMode {
    AskEveryTime,
    AutoSaveOrdinary,
    ManualOnly,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JournalMode {
    Guided,
    FreeWrite,
    QuickCheckIn,
    EndOfDay,
}

impl JournalMode {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "guided" => Ok(Self::Guided),
            "free_write" => Ok(Self::FreeWrite),
            "quick_check_in" => Ok(Self::QuickCheckIn),
            "end_of_day" => Ok(Self::EndOfDay),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported journal mode: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Guided => "guided",
            Self::FreeWrite => "free_write",
            Self::QuickCheckIn => "quick_check_in",
            Self::EndOfDay => "end_of_day",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JournalKind {
    FreeReflection,
    DailyCheckIn,
    EndOfDayReview,
    Idea,
    Life,
    Money,
    TradingSession,
    Gratitude,
    Decision,
    Other,
}

impl JournalKind {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "free_reflection" => Ok(Self::FreeReflection),
            "daily_check_in" => Ok(Self::DailyCheckIn),
            "end_of_day_review" => Ok(Self::EndOfDayReview),
            "idea" => Ok(Self::Idea),
            "life" => Ok(Self::Life),
            "money" => Ok(Self::Money),
            "trading_session" => Ok(Self::TradingSession),
            "gratitude" => Ok(Self::Gratitude),
            "decision" => Ok(Self::Decision),
            "other" => Ok(Self::Other),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported journal kind: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::FreeReflection => "free_reflection",
            Self::DailyCheckIn => "daily_check_in",
            Self::EndOfDayReview => "end_of_day_review",
            Self::Idea => "idea",
            Self::Life => "life",
            Self::Money => "money",
            Self::TradingSession => "trading_session",
            Self::Gratitude => "gratitude",
            Self::Decision => "decision",
            Self::Other => "other",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JournalStatus {
    Draft,
    Completed,
    Discarded,
}

impl JournalStatus {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "draft" => Ok(Self::Draft),
            "completed" => Ok(Self::Completed),
            "discarded" => Ok(Self::Discarded),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported journal status: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Completed => "completed",
            Self::Discarded => "discarded",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JournalSourceKind {
    DesktopGuided,
    DesktopFreeWrite,
    CompanionHome,
    ConversationConversion,
    UserCreated,
}

impl JournalSourceKind {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "desktop_guided" => Ok(Self::DesktopGuided),
            "desktop_free_write" => Ok(Self::DesktopFreeWrite),
            "companion_home" => Ok(Self::CompanionHome),
            "conversation_conversion" => Ok(Self::ConversationConversion),
            "user_created" => Ok(Self::UserCreated),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported journal source kind: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::DesktopGuided => "desktop_guided",
            Self::DesktopFreeWrite => "desktop_free_write",
            Self::CompanionHome => "companion_home",
            Self::ConversationConversion => "conversation_conversion",
            Self::UserCreated => "user_created",
        }
    }
}

impl MemoryApprovalMode {
    pub fn from_db(value: &str) -> Result<Self, StorageError> {
        match value {
            "ask_every_time" => Ok(Self::AskEveryTime),
            "auto_save_ordinary" => Ok(Self::AutoSaveOrdinary),
            "manual_only" => Ok(Self::ManualOnly),
            other => Err(StorageError::invalid_stored_data(format!(
                "Unsupported memory approval mode: {other}"
            ))),
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::AskEveryTime => "ask_every_time",
            Self::AutoSaveOrdinary => "auto_save_ordinary",
            Self::ManualOnly => "manual_only",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPreferences {
    pub memory_enabled: bool,
    pub memory_approval_mode: MemoryApprovalMode,
    pub allow_personal_memories: bool,
    pub allow_sensitive_memories: bool,
    pub show_memory_used_indicator: bool,
    pub memory_candidate_notifications: bool,
    pub temporary_memory_default_expiry_days: u32,
    pub use_memories_in_temporary_chat: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalPreferences {
    pub journaling_enabled: bool,
    pub default_journal_mode: JournalMode,
    pub default_entry_private: bool,
    pub allow_memory_candidates_from_journal: bool,
    pub daily_check_in_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub daily_check_in_time: Option<String>,
    pub evening_review_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evening_review_time: Option<String>,
    pub journal_check_in_cooldown_minutes: u32,
    pub show_mood_prompt: bool,
    pub show_energy_prompt: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityPreferences {
    pub conversation_compaction_enabled: bool,
    pub semantic_memory_enabled: bool,
    pub consolidation_enabled: bool,
    pub automatic_ordinary_learning_enabled: bool,
    pub embedding_model: String,
    pub embed_sensitive_content: bool,
    pub recent_message_count: u32,
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
    pub autonomous_movement_enabled: bool,
    pub movement_intensity: MovementIntensity,
    pub surface_interaction_enabled: bool,
    pub follow_moving_surfaces: bool,
    pub cursor_awareness_enabled: bool,
    pub multi_monitor_wandering_enabled: bool,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_hyperliquid_account_id: Option<String>,
    pub companion_preferences: CompanionPreferences,
    pub memory_preferences: MemoryPreferences,
    pub journal_preferences: JournalPreferences,
    pub continuity_preferences: ContinuityPreferences,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub id: String,
    pub category: MemoryCategory,
    pub content: String,
    pub normalized_content: String,
    pub status: MemoryStatus,
    pub source_kind: MemorySourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
    pub confidence: f64,
    pub importance: f64,
    pub sensitivity: MemorySensitivity,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub use_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supersedes_memory_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDraft {
    pub category: MemoryCategory,
    pub content: String,
    pub status: MemoryStatus,
    pub source_kind: MemorySourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
    pub confidence: f64,
    pub importance: f64,
    pub sensitivity: MemorySensitivity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supersedes_memory_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryListOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<MemoryStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<MemoryCategory>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sensitivity: Option<MemorySensitivity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    pub limit: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RetrievedMemory {
    pub id: String,
    pub category: MemoryCategory,
    pub content: String,
    pub sensitivity: MemorySensitivity,
    pub score: f64,
    pub match_reasons: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDiagnostics {
    pub total_count: u32,
    pub proposed_count: u32,
    pub confirmed_count: u32,
    pub rejected_count: u32,
    pub expired_count: u32,
    pub superseded_count: u32,
    pub sensitive_count: u32,
    pub fts_available: bool,
    pub fixture_count: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryUsageRecord {
    pub id: String,
    pub memory_id: String,
    pub conversation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assistant_message_id: Option<String>,
    pub used_at: String,
    pub reason_code: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryUsageRequest {
    pub memory_ids: Vec<String>,
    pub conversation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assistant_message_id: Option<String>,
    pub reason_code: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAllMemoriesResult {
    pub deleted_memories: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryExportResult {
    pub exported_memories: u32,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct MemoryExportFile {
    pub format: String,
    pub version: u32,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub settings: MemoryPreferences,
    pub memories: Vec<Memory>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    pub kind: JournalKind,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub status: JournalStatus,
    pub source_kind: JournalSourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stress: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<u32>,
    pub occurred_at: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    pub allow_memory_candidates: bool,
    pub is_private: bool,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryDraft {
    pub kind: JournalKind,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub status: JournalStatus,
    pub source_kind: JournalSourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stress: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<String>,
    pub allow_memory_candidates: bool,
    pub is_private: bool,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryUpdate {
    pub entry_id: String,
    pub kind: JournalKind,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub status: JournalStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stress: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<u32>,
    pub allow_memory_candidates: bool,
    pub is_private: bool,
    pub tags: Vec<String>,
    pub expected_updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntrySummary {
    pub id: String,
    pub kind: JournalKind,
    pub title: String,
    pub preview: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub status: JournalStatus,
    pub occurred_at: String,
    pub updated_at: String,
    pub is_private: bool,
    pub allow_memory_candidates: bool,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalListOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<JournalStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<JournalKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_date: Option<String>,
    pub include_private: bool,
    pub include_discarded: bool,
    pub sort: JournalSort,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JournalSort {
    Newest,
    Oldest,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAllJournalResult {
    pub deleted_entries: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalExportResult {
    pub exported_entries: u32,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalDiagnostics {
    pub total_count: u32,
    pub draft_count: u32,
    pub completed_count: u32,
    pub discarded_count: u32,
    pub private_count: u32,
    pub fixture_count: u32,
    pub tag_count: u32,
    pub fts_available: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DevelopmentJournalFixtureResult {
    pub created_entries: u32,
    pub deleted_entries: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalExportFile {
    pub format: String,
    pub version: u32,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub entries: Vec<JournalEntry>,
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
pub struct AgentSessionLink {
    pub local_conversation_id: String,
    pub backend: String,
    pub remote_session_id: String,
    pub remote_session_key: String,
    pub status: String,
    pub last_completed_message_id: Option<String>,
    pub last_request_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAgentSessionLink {
    pub local_conversation_id: String,
    pub remote_session_id: String,
    pub remote_session_key: String,
    pub status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareAgentTurnRequest {
    pub conversation_id: Option<String>,
    pub request_id: String,
    pub turn_id: String,
    pub user_content: String,
    pub model_name: String,
    pub support_mode: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareAgentTurnResponse {
    pub conversation: ConversationSummary,
    pub user_message: StoredMessage,
    pub assistant_message: StoredMessage,
    pub turn_id: String,
    pub support_mode: String,
    pub attempt: u32,
    pub reused: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RetryAgentTurnRequest {
    pub conversation_id: String,
    pub request_id: String,
    pub turn_id: String,
    pub model_name: String,
    pub support_mode: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RetryAgentTurnResponse {
    pub conversation: ConversationSummary,
    pub user_message: StoredMessage,
    pub assistant_message: StoredMessage,
    pub turn_id: String,
    pub support_mode: String,
    pub attempt: u32,
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
#[serde(rename_all = "camelCase")]
pub struct DevelopmentMemoryFixtureResult {
    pub created_memories: u32,
    pub deleted_memories: u32,
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
