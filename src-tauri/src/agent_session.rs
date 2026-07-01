use std::{path::Path, sync::Arc};

use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    agent_events::{
        AgentConnectionStatus, AgentSessionError, AgentSessionMessage, AgentSessionSnapshot,
        AgentStreamEvent, AgentStreamEventType, AgentTurnStatus, CompanionSupportMode,
        AGENT_RUNTIME_STATUS_EVENT, AGENT_SESSION_SNAPSHOT_EVENT, AGENT_STREAM_EVENT,
    },
    hermes_process::{
        GatewayLaunchConfig, HermesProcessDiagnostics, HermesProcessManager, HermesRuntimeStatus,
    },
    hermes_rpc::{GatewayEvent, HermesMethod},
    storage::{
        models::{
            AssistantMessageFailure, AssistantMessageUpdate, PrepareAgentTurnRequest,
            StoredMessage, StoredMessageRole, StoredMessageStatus, UpsertAgentSessionLink,
        },
        repository, StorageService,
    },
};

const MAX_USER_MESSAGE_CHARS: usize = 20_000;
const MAX_HIDDEN_CONTEXT_CHARS: usize = 12_000;
const MAX_ASSISTANT_MESSAGE_CHARS: usize = 100_000;
const CHECKPOINT_CHARACTERS: usize = 500;

#[derive(Clone)]
pub struct AgentSessionRuntime {
    app: AppHandle,
    process: HermesProcessManager,
    storage: StorageService,
    snapshot: Arc<Mutex<AgentSessionSnapshot>>,
    persistence: Arc<Mutex<Option<ActivePersistence>>>,
}

#[derive(Debug, Deserialize)]
struct OpenSessionRequest {
    #[serde(rename = "localConversationId")]
    local_conversation_id: Option<String>,
    model: String,
    temporary: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitSessionRequest {
    local_conversation_id: Option<String>,
    request_id: String,
    turn_id: String,
    text: String,
    model: String,
    temporary: bool,
    #[serde(default)]
    hidden_context: String,
}

#[derive(Clone, Debug)]
struct ActivePersistence {
    assistant_message_id: String,
    request_id: String,
    content: String,
    last_checkpoint_characters: usize,
    persistent: bool,
}

impl AgentSessionRuntime {
    pub fn new(
        app: AppHandle,
        app_data_dir: &Path,
        storage: StorageService,
    ) -> Result<Self, String> {
        let config = GatewayLaunchConfig::development(app_data_dir)?;
        let runtime = Self {
            app,
            process: HermesProcessManager::new(config),
            storage,
            snapshot: Arc::new(Mutex::new(AgentSessionSnapshot::default())),
            persistence: Arc::new(Mutex::new(None)),
        };
        runtime.spawn_monitors();
        Ok(runtime)
    }

    fn spawn_monitors(&self) {
        let runtime = self.clone();
        let mut events = self.process.subscribe_events();
        tauri::async_runtime::spawn(async move {
            while let Ok(event) = events.recv().await {
                runtime.handle_gateway_event(event).await;
            }
        });
        let runtime = self.clone();
        let mut statuses = self.process.subscribe_status();
        tauri::async_runtime::spawn(async move {
            while statuses.changed().await.is_ok() {
                let status = *statuses.borrow_and_update();
                runtime.handle_process_status(status).await;
            }
        });
    }

    pub async fn diagnostics(&self) -> HermesProcessDiagnostics {
        self.process.diagnostics().await
    }

    pub async fn snapshot(&self) -> AgentSessionSnapshot {
        let process_status = self.process.diagnostics().await.status;
        let mut snapshot = self.snapshot.lock().await;
        snapshot.connection_status = process_status.into();
        snapshot.clone()
    }

    pub async fn start(&self) -> Result<AgentSessionSnapshot, String> {
        self.process.start().await?;
        self.update_connection(HermesRuntimeStatus::Ready).await;
        Ok(self.snapshot().await)
    }

    pub async fn retry_connection(&self) -> Result<AgentSessionSnapshot, String> {
        self.process.explicit_restart().await?;
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.connection_status = AgentConnectionStatus::Ready;
            snapshot.diagnostics.reconnect_count =
                snapshot.diagnostics.reconnect_count.saturating_add(1);
        }
        self.broadcast_snapshot().await;
        Ok(self.snapshot().await)
    }

    async fn open(&self, request: OpenSessionRequest) -> Result<AgentSessionSnapshot, String> {
        validate_model(&request.model)?;
        if let Some(conversation_id) = request.local_conversation_id.as_deref() {
            validate_identifier(conversation_id)?;
        }
        self.process.start().await?;
        let existing_link = if request.temporary {
            None
        } else if let Some(conversation_id) = request.local_conversation_id.clone() {
            self.storage
                .run(move |connection, _| {
                    repository::agent_session_link(connection, &conversation_id)
                })
                .await
                .map_err(|error| error.to_string())?
        } else {
            None
        };
        let result = if let Some(link) = existing_link {
            self.process
                .request(
                    HermesMethod::SessionResume,
                    json!({
                        "session_id": link.remote_session_key,
                        "cols": 80,
                        "source": "trading_buddy",
                    }),
                )
                .await
                .map_err(|error| error.message)?
        } else {
            self.process
                .request(
                    HermesMethod::SessionCreate,
                    json!({
                        "cols": 80,
                        "source": "trading_buddy",
                        "model": request.model,
                        "provider": "custom",
                        "close_on_disconnect": request.temporary,
                        "trading_buddy_ephemeral": request.temporary,
                    }),
                )
                .await
                .map_err(|error| error.message)?
        };
        let live_id = required_string(&result, "session_id")?;
        let stored_key = optional_string(&result, "stored_session_id")
            .or_else(|| optional_string(&result, "session_key"))
            .ok_or_else(|| {
                "Local agent gateway returned an invalid session response.".to_owned()
            })?;
        if let Some(conversation_id) = request
            .local_conversation_id
            .clone()
            .filter(|_| !request.temporary)
        {
            let link = UpsertAgentSessionLink {
                local_conversation_id: conversation_id,
                remote_session_id: live_id.clone(),
                remote_session_key: stored_key.clone(),
                status: "active".to_owned(),
            };
            self.storage
                .run(move |connection, _| repository::upsert_agent_session_link(connection, link))
                .await
                .map_err(|error| error.to_string())?;
        }
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.local_conversation_id = request.local_conversation_id;
            snapshot.hermes_session_id = Some(live_id);
            snapshot.hermes_session_key = Some(stored_key);
            snapshot.connection_status = AgentConnectionStatus::Ready;
            snapshot.temporary = request.temporary;
            snapshot.recoverable_error = None;
        }
        self.broadcast_snapshot().await;
        Ok(self.snapshot().await)
    }

    async fn submit(&self, request: SubmitSessionRequest) -> Result<AgentSessionSnapshot, String> {
        validate_identifier(&request.request_id)?;
        validate_identifier(&request.turn_id)?;
        validate_model(&request.model)?;
        let text = request.text.trim().to_owned();
        if text.is_empty() || text.len() > MAX_USER_MESSAGE_CHARS {
            return Err("Message is empty or too long.".to_owned());
        }
        if request.hidden_context.len() > MAX_HIDDEN_CONTEXT_CHARS {
            return Err("Hidden companion context is too large.".to_owned());
        }
        if let Some(conversation_id) = request.local_conversation_id.as_deref() {
            validate_identifier(conversation_id)?;
        }
        let support_mode = {
            let snapshot = self.snapshot.lock().await;
            if snapshot.active_request_id.is_some() {
                return Err("A companion response is already active.".to_owned());
            }
            snapshot.support_mode.clone()
        };

        let (conversation_id, messages, assistant_message_id) = if request.temporary {
            let conversation_id = request
                .local_conversation_id
                .clone()
                .unwrap_or_else(|| format!("temporary-{}", Uuid::new_v4()));
            let now = Utc::now().to_rfc3339();
            let user_id = format!("message-{}", Uuid::new_v4());
            let assistant_id = format!("message-{}", Uuid::new_v4());
            let mut messages = self.snapshot.lock().await.messages.clone();
            messages.push(AgentSessionMessage {
                id: user_id.clone(),
                role: "user".to_owned(),
                content: text.clone(),
                created_at: now.clone(),
                status: "completed".to_owned(),
                request_id: None,
                source_user_message_id: None,
                attempt: None,
            });
            messages.push(AgentSessionMessage {
                id: assistant_id.clone(),
                role: "assistant".to_owned(),
                content: String::new(),
                created_at: now,
                status: "streaming".to_owned(),
                request_id: Some(request.request_id.clone()),
                source_user_message_id: Some(user_id),
                attempt: Some(1),
            });
            (conversation_id, messages, assistant_id)
        } else {
            let turn = PrepareAgentTurnRequest {
                conversation_id: request.local_conversation_id.clone(),
                request_id: request.request_id.clone(),
                turn_id: request.turn_id.clone(),
                user_content: text.clone(),
                model_name: request.model.clone(),
                support_mode: support_mode.as_str().to_owned(),
            };
            let prepared = self
                .storage
                .run(move |connection, _| repository::prepare_agent_turn(connection, turn))
                .await
                .map_err(|error| error.to_string())?;
            let conversation_id = prepared.conversation.id.clone();
            let detail_id = conversation_id.clone();
            let detail = self
                .storage
                .run(move |connection, _| repository::get_conversation(connection, &detail_id))
                .await
                .map_err(|error| error.to_string())?;
            (
                conversation_id,
                detail.messages.iter().map(agent_message).collect(),
                prepared.assistant_message.id,
            )
        };

        let prior_session = self.snapshot.lock().await.clone();
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.local_conversation_id = Some(conversation_id.clone());
            snapshot.messages = messages;
            snapshot.active_request_id = Some(request.request_id.clone());
            snapshot.active_turn_id = Some(request.turn_id.clone());
            snapshot.turn_status = AgentTurnStatus::Submitting;
            snapshot.recoverable_error = None;
        }
        *self.persistence.lock().await = Some(ActivePersistence {
            assistant_message_id,
            request_id: request.request_id.clone(),
            content: String::new(),
            last_checkpoint_characters: 0,
            persistent: !request.temporary,
        });
        let must_open = prior_session.hermes_session_id.is_none()
            || prior_session.local_conversation_id.as_deref() != Some(conversation_id.as_str())
            || prior_session.temporary != request.temporary;
        if must_open {
            if let Err(error) = self
                .open(OpenSessionRequest {
                    local_conversation_id: Some(conversation_id.clone()),
                    model: request.model,
                    temporary: request.temporary,
                })
                .await
            {
                self.finalize_turn(
                    AgentStreamEventType::Failed,
                    Some(AgentSessionError {
                        code: "backend_unavailable".to_owned(),
                        user_message: error.clone(),
                        retryable: true,
                    }),
                )
                .await;
                return Err(error);
            }
        }
        self.publish_lifecycle(AgentStreamEventType::Accepted, None, None)
            .await;
        self.publish_lifecycle(AgentStreamEventType::Listening, None, None)
            .await;
        self.set_buddy_state("listening");

        let session_id = self
            .snapshot
            .lock()
            .await
            .hermes_session_id
            .clone()
            .ok_or_else(|| "No active local agent session.".to_owned())?;
        if let Err(error) = self
            .process
            .request(
                HermesMethod::PromptSubmit,
                json!({
                    "session_id": session_id,
                    "text": text,
                    "support_mode": support_mode.as_str(),
                    "client_request_id": request.request_id,
                    "companion_context": request.hidden_context,
                }),
            )
            .await
        {
            self.finalize_turn(
                AgentStreamEventType::Failed,
                Some(AgentSessionError {
                    code: "backend_unavailable".to_owned(),
                    user_message: error.message.clone(),
                    retryable: true,
                }),
            )
            .await;
            return Err(error.message);
        }
        Ok(self.snapshot().await)
    }

    async fn handle_gateway_event(&self, event: GatewayEvent) {
        let active = self.snapshot.lock().await.clone();
        if event.session_id.as_deref() != active.hermes_session_id.as_deref()
            || active.active_request_id.is_none()
            || active.active_turn_id.is_none()
        {
            return;
        }
        let payload = event.payload.as_ref();
        let payload_request_id = payload
            .and_then(|value| value.get("client_request_id"))
            .and_then(Value::as_str);
        if payload_request_id.is_some() && payload_request_id != active.active_request_id.as_deref()
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.diagnostics.stale_event_count =
                snapshot.diagnostics.stale_event_count.saturating_add(1);
            return;
        }
        match event.event_type.as_str() {
            "message.start" => {
                self.publish_lifecycle(AgentStreamEventType::Thinking, None, None)
                    .await;
                self.set_buddy_state("thinking");
            }
            "message.delta" => {
                let Some(content) = payload
                    .and_then(|value| value.get("text"))
                    .and_then(Value::as_str)
                else {
                    return;
                };
                if content.is_empty() || content.len() > 32_768 {
                    return;
                }
                self.apply_delta(content).await;
            }
            "message.complete" => {
                let status = payload
                    .and_then(|value| value.get("status"))
                    .and_then(Value::as_str)
                    .unwrap_or("complete");
                if self
                    .persistence
                    .lock()
                    .await
                    .as_ref()
                    .is_some_and(|persistence| persistence.content.is_empty())
                {
                    if let Some(content) = payload
                        .and_then(|value| value.get("text"))
                        .and_then(Value::as_str)
                    {
                        self.apply_delta(&bounded_text(content, MAX_ASSISTANT_MESSAGE_CHARS))
                            .await;
                    }
                }
                match status {
                    "complete" => {
                        self.finalize_turn(AgentStreamEventType::Completed, None)
                            .await;
                    }
                    "interrupted" => {
                        self.finalize_turn(AgentStreamEventType::Cancelled, None)
                            .await;
                    }
                    _ => {
                        self.finalize_turn(
                            AgentStreamEventType::Failed,
                            Some(AgentSessionError {
                                code: "internal_error".to_owned(),
                                user_message: "The local model could not complete this response."
                                    .to_owned(),
                                retryable: true,
                            }),
                        )
                        .await;
                    }
                }
            }
            "error" => {
                self.finalize_turn(
                    AgentStreamEventType::Failed,
                    Some(AgentSessionError {
                        code: "internal_error".to_owned(),
                        user_message: "The local agent reported an error.".to_owned(),
                        retryable: true,
                    }),
                )
                .await;
            }
            _ => {}
        }
    }

    async fn handle_process_status(&self, status: HermesRuntimeStatus) {
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.connection_status = status.into();
        }
        let _ = self.app.emit(
            AGENT_RUNTIME_STATUS_EVENT,
            AgentConnectionStatus::from(status),
        );
        if status == HermesRuntimeStatus::Offline
            && self.snapshot.lock().await.active_request_id.is_some()
        {
            self.publish_lifecycle(
                AgentStreamEventType::ConnectionLost,
                None,
                Some(AgentSessionError {
                    code: "request_interrupted".to_owned(),
                    user_message:
                        "Buddy lost the local agent connection. Your message was not resubmitted."
                            .to_owned(),
                    retryable: true,
                }),
            )
            .await;
            self.finalize_turn(
                AgentStreamEventType::Failed,
                Some(AgentSessionError {
                    code: "request_interrupted".to_owned(),
                    user_message: "The response was interrupted. You can retry it safely."
                        .to_owned(),
                    retryable: true,
                }),
            )
            .await;
        }
        self.broadcast_snapshot().await;
    }

    async fn apply_delta(&self, content: &str) {
        let (bounded_delta, checkpoint) = {
            let mut persistence = self.persistence.lock().await;
            let Some(persistence) = persistence.as_mut() else {
                return;
            };
            let remaining = MAX_ASSISTANT_MESSAGE_CHARS.saturating_sub(persistence.content.len());
            let bounded: String = content.chars().take(remaining).collect();
            persistence.content.push_str(&bounded);
            let checkpoint = persistence.persistent
                && persistence
                    .content
                    .len()
                    .saturating_sub(persistence.last_checkpoint_characters)
                    >= CHECKPOINT_CHARACTERS;
            if checkpoint {
                persistence.last_checkpoint_characters = persistence.content.len();
            }
            (bounded, checkpoint.then(|| persistence.clone()))
        };
        if bounded_delta.is_empty() {
            return;
        }
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.turn_status = AgentTurnStatus::Streaming;
            let active_request_id = snapshot.active_request_id.clone();
            if let Some(message) = snapshot.messages.iter_mut().find(|message| {
                message.role == "assistant"
                    && message.request_id.as_deref() == active_request_id.as_deref()
            }) {
                message.content.push_str(&bounded_delta);
                message.status = "streaming".to_owned();
            }
        }
        if let Some(persistence) = checkpoint {
            let update = AssistantMessageUpdate {
                message_id: persistence.assistant_message_id,
                request_id: persistence.request_id,
                content: persistence.content,
            };
            let _ = self
                .storage
                .run(move |connection, _| repository::checkpoint_assistant(connection, update))
                .await;
        }
        self.publish_lifecycle(
            AgentStreamEventType::ContentDelta,
            Some(bounded_delta),
            None,
        )
        .await;
        self.set_buddy_state("talking");
    }

    async fn finalize_turn(
        &self,
        event_type: AgentStreamEventType,
        error: Option<AgentSessionError>,
    ) {
        let persistence = self.persistence.lock().await.take();
        let Some(persistence) = persistence else {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.diagnostics.duplicate_event_count =
                snapshot.diagnostics.duplicate_event_count.saturating_add(1);
            return;
        };
        if persistence.persistent {
            let update = AssistantMessageUpdate {
                message_id: persistence.assistant_message_id.clone(),
                request_id: persistence.request_id.clone(),
                content: persistence.content.clone(),
            };
            let result = match event_type {
                AgentStreamEventType::Completed => {
                    self.storage
                        .run(move |connection, _| {
                            repository::complete_assistant(connection, update)
                        })
                        .await
                }
                AgentStreamEventType::Cancelled => {
                    self.storage
                        .run(move |connection, _| repository::cancel_assistant(connection, update))
                        .await
                }
                _ => {
                    let failure = AssistantMessageFailure {
                        message_id: update.message_id,
                        request_id: update.request_id,
                        content: update.content,
                        error_code: error
                            .as_ref()
                            .map(|error| error.code.clone())
                            .unwrap_or_else(|| "generation_failed".to_owned()),
                    };
                    self.storage
                        .run(move |connection, _| repository::fail_assistant(connection, failure))
                        .await
                }
            };
            if result.is_err() {
                return;
            }
        }
        {
            let mut snapshot = self.snapshot.lock().await;
            let request_id = snapshot.active_request_id.clone();
            snapshot.active_request_id = None;
            snapshot.active_turn_id = None;
            snapshot.turn_status = match event_type {
                AgentStreamEventType::Completed => AgentTurnStatus::Completed,
                AgentStreamEventType::Cancelled => AgentTurnStatus::Cancelled,
                _ => AgentTurnStatus::Failed,
            };
            snapshot.recoverable_error = error.clone();
            if let Some(message) = snapshot
                .messages
                .iter_mut()
                .find(|message| message.role == "assistant" && message.request_id == request_id)
            {
                message.status = match event_type {
                    AgentStreamEventType::Completed => "completed",
                    AgentStreamEventType::Cancelled => "cancelled",
                    _ => "failed",
                }
                .to_owned();
            }
        }
        self.publish_terminal(event_type.clone(), &persistence, error)
            .await;
        self.broadcast_snapshot().await;
        self.set_buddy_state(if matches!(event_type, AgentStreamEventType::Failed) {
            "concerned"
        } else {
            "idle"
        });
    }

    async fn set_support_mode(&self, support_mode: CompanionSupportMode) -> AgentSessionSnapshot {
        {
            let mut snapshot = self.snapshot.lock().await;
            snapshot.support_mode = support_mode;
        }
        self.broadcast_snapshot().await;
        self.snapshot().await
    }

    async fn interrupt(&self) -> Result<AgentSessionSnapshot, String> {
        let session_id = self
            .snapshot
            .lock()
            .await
            .hermes_session_id
            .clone()
            .ok_or_else(|| "No active local agent session.".to_owned())?;
        self.process
            .request(
                HermesMethod::SessionInterrupt,
                json!({"session_id": session_id}),
            )
            .await
            .map_err(|error| error.message)?;
        Ok(self.snapshot().await)
    }

    async fn close(&self) -> Result<AgentSessionSnapshot, String> {
        let current = self.snapshot.lock().await.clone();
        if let Some(session_id) = current.hermes_session_id {
            self.process
                .request(
                    HermesMethod::SessionClose,
                    json!({"session_id": session_id}),
                )
                .await
                .map_err(|error| error.message)?;
        }
        {
            let mut snapshot = self.snapshot.lock().await;
            *snapshot = AgentSessionSnapshot::default();
            snapshot.connection_status = self.process.diagnostics().await.status.into();
        }
        self.broadcast_snapshot().await;
        Ok(self.snapshot().await)
    }

    async fn purge_conversation_runtime(&self, conversation_id: String) -> Result<bool, String> {
        validate_identifier(&conversation_id)?;
        let lookup_id = conversation_id.clone();
        let link = self
            .storage
            .run(move |connection, _| repository::agent_session_link(connection, &lookup_id))
            .await
            .map_err(|error| error.to_string())?;
        let Some(link) = link else {
            return Ok(false);
        };
        self.process
            .request(
                HermesMethod::TradingBuddySessionDelete,
                json!({"session_id": link.remote_session_key}),
            )
            .await
            .map_err(|error| error.message)?;
        self.storage
            .run(move |connection, _| {
                repository::delete_agent_session_link(connection, &conversation_id)
            })
            .await
            .map_err(|error| error.to_string())?;
        Ok(true)
    }

    async fn stop(&self) -> Result<(), String> {
        self.process.stop().await?;
        self.update_connection(HermesRuntimeStatus::Stopped).await;
        Ok(())
    }

    async fn update_connection(&self, status: HermesRuntimeStatus) {
        self.snapshot.lock().await.connection_status = status.into();
        let _ = self.app.emit(AGENT_RUNTIME_STATUS_EVENT, status);
        self.broadcast_snapshot().await;
    }

    async fn broadcast_snapshot(&self) {
        let snapshot = self.snapshot.lock().await.clone();
        let _ = self
            .app
            .emit_to("bubble", AGENT_SESSION_SNAPSHOT_EVENT, snapshot.clone());
        let _ = self
            .app
            .emit_to("main", AGENT_SESSION_SNAPSHOT_EVENT, snapshot);
    }

    async fn publish_lifecycle(
        &self,
        event_type: AgentStreamEventType,
        content: Option<String>,
        error: Option<AgentSessionError>,
    ) {
        let event = {
            let mut snapshot = self.snapshot.lock().await;
            let Some(session_id) = snapshot.hermes_session_id.clone() else {
                return;
            };
            let Some(request_id) = snapshot.active_request_id.clone() else {
                return;
            };
            let Some(turn_id) = snapshot.active_turn_id.clone() else {
                return;
            };
            snapshot.last_sequence = snapshot.last_sequence.saturating_add(1);
            snapshot.turn_status = match event_type {
                AgentStreamEventType::Accepted => AgentTurnStatus::Submitting,
                AgentStreamEventType::Listening => AgentTurnStatus::Listening,
                AgentStreamEventType::Thinking => AgentTurnStatus::Thinking,
                AgentStreamEventType::ContentDelta => AgentTurnStatus::Streaming,
                AgentStreamEventType::Completed => AgentTurnStatus::Completed,
                AgentStreamEventType::Cancelled => AgentTurnStatus::Cancelled,
                AgentStreamEventType::Failed | AgentStreamEventType::ConnectionLost => {
                    AgentTurnStatus::Failed
                }
                AgentStreamEventType::ConnectionRestored => snapshot.turn_status.clone(),
            };
            AgentStreamEvent {
                session_id,
                request_id,
                turn_id,
                sequence: snapshot.last_sequence,
                event_type,
                content,
                error,
            }
        };
        self.broadcast_stream(event);
        self.broadcast_snapshot().await;
    }

    async fn publish_terminal(
        &self,
        event_type: AgentStreamEventType,
        persistence: &ActivePersistence,
        error: Option<AgentSessionError>,
    ) {
        let event = {
            let mut snapshot = self.snapshot.lock().await;
            let Some(session_id) = snapshot.hermes_session_id.clone() else {
                return;
            };
            let Some(turn_id) = snapshot.active_turn_id.clone() else {
                return;
            };
            snapshot.last_sequence = snapshot.last_sequence.saturating_add(1);
            AgentStreamEvent {
                session_id,
                request_id: persistence.request_id.clone(),
                turn_id,
                sequence: snapshot.last_sequence,
                event_type,
                content: None,
                error,
            }
        };
        self.broadcast_stream(event);
    }

    fn broadcast_stream(&self, event: AgentStreamEvent) {
        let _ = self
            .app
            .emit_to("bubble", AGENT_STREAM_EVENT, event.clone());
        let _ = self.app.emit_to("main", AGENT_STREAM_EVENT, event);
    }

    fn set_buddy_state(&self, state: &str) {
        let _ = self.app.emit_to(
            "buddy",
            "trading-buddy://companion-command",
            json!({"type": "set_state", "state": state}),
        );
    }
}

#[tauri::command]
pub async fn agent_runtime_status(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<HermesProcessDiagnostics, String> {
    Ok(runtime.diagnostics().await)
}

#[tauri::command]
pub async fn agent_session_snapshot(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<AgentSessionSnapshot, String> {
    Ok(runtime.snapshot().await)
}

#[tauri::command]
pub async fn agent_runtime_start(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<AgentSessionSnapshot, String> {
    runtime.start().await
}

#[tauri::command]
pub async fn agent_runtime_retry_connection(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<AgentSessionSnapshot, String> {
    runtime.retry_connection().await
}

#[tauri::command]
pub async fn agent_session_open(
    runtime: tauri::State<'_, AgentSessionRuntime>,
    request: Value,
) -> Result<AgentSessionSnapshot, String> {
    let request: OpenSessionRequest = serde_json::from_value(request)
        .map_err(|_| "Invalid local agent session request.".to_owned())?;
    runtime.open(request).await
}

#[tauri::command]
pub async fn agent_session_submit(
    runtime: tauri::State<'_, AgentSessionRuntime>,
    request: Value,
) -> Result<AgentSessionSnapshot, String> {
    let request: SubmitSessionRequest = serde_json::from_value(request)
        .map_err(|_| "Invalid local agent submit request.".to_owned())?;
    runtime.submit(request).await
}

#[tauri::command]
pub async fn agent_session_set_support_mode(
    runtime: tauri::State<'_, AgentSessionRuntime>,
    support_mode: CompanionSupportMode,
) -> Result<AgentSessionSnapshot, String> {
    Ok(runtime.set_support_mode(support_mode).await)
}

#[tauri::command]
pub async fn agent_session_interrupt(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<AgentSessionSnapshot, String> {
    runtime.interrupt().await
}

#[tauri::command]
pub async fn agent_session_close(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<AgentSessionSnapshot, String> {
    runtime.close().await
}

#[tauri::command]
pub async fn agent_session_purge_conversation(
    runtime: tauri::State<'_, AgentSessionRuntime>,
    conversation_id: String,
) -> Result<bool, String> {
    runtime.purge_conversation_runtime(conversation_id).await
}

#[tauri::command]
pub async fn agent_runtime_stop(
    runtime: tauri::State<'_, AgentSessionRuntime>,
) -> Result<(), String> {
    runtime.stop().await
}

fn required_string(value: &Value, key: &str) -> Result<String, String> {
    optional_string(value, key)
        .ok_or_else(|| "Local agent gateway returned an invalid session response.".to_owned())
}

fn optional_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty() && value.len() <= 128)
        .map(str::to_owned)
}

fn validate_identifier(value: &str) -> Result<(), String> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_:.".contains(character))
    {
        Ok(())
    } else {
        Err("Invalid local conversation ID.".to_owned())
    }
}

fn validate_model(value: &str) -> Result<(), String> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_:.@/".contains(character))
    {
        Ok(())
    } else {
        Err("Invalid local model name.".to_owned())
    }
}

fn bounded_text(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_owned();
    }
    let mut end = max_bytes;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_owned()
}

fn agent_message(message: &StoredMessage) -> AgentSessionMessage {
    AgentSessionMessage {
        id: message.id.clone(),
        role: match message.role {
            StoredMessageRole::User => "user",
            StoredMessageRole::Assistant => "assistant",
        }
        .to_owned(),
        content: bounded_text(&message.content, MAX_ASSISTANT_MESSAGE_CHARS),
        created_at: message.created_at.clone(),
        status: match message.status {
            StoredMessageStatus::Completed => "completed",
            StoredMessageStatus::Streaming => "streaming",
            StoredMessageStatus::Cancelled => "cancelled",
            StoredMessageStatus::Failed | StoredMessageStatus::Interrupted => "failed",
        }
        .to_owned(),
        request_id: message.request_id.clone(),
        source_user_message_id: None,
        attempt: None,
    }
}
