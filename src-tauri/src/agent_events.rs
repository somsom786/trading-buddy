use serde::{Deserialize, Serialize};

use crate::hermes_process::HermesRuntimeStatus;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentConnectionStatus {
    Stopped,
    Starting,
    Connecting,
    Ready,
    Reconnecting,
    Offline,
    Failed,
}

impl From<HermesRuntimeStatus> for AgentConnectionStatus {
    fn from(value: HermesRuntimeStatus) -> Self {
        match value {
            HermesRuntimeStatus::Stopped | HermesRuntimeStatus::Stopping => Self::Stopped,
            HermesRuntimeStatus::Starting => Self::Starting,
            HermesRuntimeStatus::Ready => Self::Ready,
            HermesRuntimeStatus::Reconnecting => Self::Reconnecting,
            HermesRuntimeStatus::Offline => Self::Offline,
            HermesRuntimeStatus::Failed => Self::Failed,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentTurnStatus {
    Idle,
    Submitting,
    Listening,
    Thinking,
    Streaming,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompanionSupportMode {
    Listen,
    #[default]
    Reflect,
    Plan,
    HangOut,
    Presence,
}

impl CompanionSupportMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Listen => "listen",
            Self::Reflect => "reflect",
            Self::Plan => "plan",
            Self::HangOut => "hang_out",
            Self::Presence => "presence",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionDiagnostics {
    pub duplicate_event_count: u64,
    pub stale_event_count: u64,
    pub reconnect_count: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSnapshot {
    pub local_conversation_id: Option<String>,
    pub hermes_session_id: Option<String>,
    pub hermes_session_key: Option<String>,
    pub connection_status: AgentConnectionStatus,
    pub turn_status: AgentTurnStatus,
    pub active_request_id: Option<String>,
    pub active_turn_id: Option<String>,
    pub support_mode: CompanionSupportMode,
    pub temporary: bool,
    pub messages: Vec<AgentSessionMessage>,
    pub last_sequence: u64,
    pub recoverable_error: Option<AgentSessionError>,
    pub diagnostics: AgentSessionDiagnostics,
}

impl Default for AgentSessionSnapshot {
    fn default() -> Self {
        Self {
            local_conversation_id: None,
            hermes_session_id: None,
            hermes_session_key: None,
            connection_status: AgentConnectionStatus::Stopped,
            turn_status: AgentTurnStatus::Idle,
            active_request_id: None,
            active_turn_id: None,
            support_mode: CompanionSupportMode::default(),
            temporary: false,
            messages: Vec::new(),
            last_sequence: 0,
            recoverable_error: None,
            diagnostics: AgentSessionDiagnostics {
                duplicate_event_count: 0,
                stale_event_count: 0,
                reconnect_count: 0,
            },
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub status: String,
    pub request_id: Option<String>,
    pub source_user_message_id: Option<String>,
    pub attempt: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionError {
    pub code: String,
    pub user_message: String,
    pub retryable: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStreamEventType {
    Accepted,
    Listening,
    Thinking,
    ContentDelta,
    Completed,
    Cancelled,
    Failed,
    ConnectionLost,
    ConnectionRestored,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStreamEvent {
    pub session_id: String,
    pub request_id: String,
    pub turn_id: String,
    pub sequence: u64,
    #[serde(rename = "type")]
    pub event_type: AgentStreamEventType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AgentSessionError>,
}

pub const AGENT_RUNTIME_STATUS_EVENT: &str = "agent://runtime-status";
pub const AGENT_SESSION_SNAPSHOT_EVENT: &str = "agent://session-snapshot";
pub const AGENT_STREAM_EVENT: &str = "agent://stream-event";
