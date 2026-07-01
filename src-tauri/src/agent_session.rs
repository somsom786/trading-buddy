use std::{path::Path, sync::Arc};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::{
    agent_events::{
        AgentConnectionStatus, AgentSessionSnapshot, CompanionSupportMode,
        AGENT_RUNTIME_STATUS_EVENT, AGENT_SESSION_SNAPSHOT_EVENT,
    },
    hermes_process::{
        GatewayLaunchConfig, HermesProcessDiagnostics, HermesProcessManager, HermesRuntimeStatus,
    },
    hermes_rpc::HermesMethod,
    storage::{models::UpsertAgentSessionLink, repository, StorageService},
};

#[derive(Clone)]
pub struct AgentSessionRuntime {
    app: AppHandle,
    process: HermesProcessManager,
    storage: StorageService,
    snapshot: Arc<Mutex<AgentSessionSnapshot>>,
}

#[derive(Debug, Deserialize)]
struct OpenSessionRequest {
    #[serde(rename = "localConversationId")]
    local_conversation_id: Option<String>,
    model: String,
    temporary: bool,
}

impl AgentSessionRuntime {
    pub fn new(
        app: AppHandle,
        app_data_dir: &Path,
        storage: StorageService,
    ) -> Result<Self, String> {
        let config = GatewayLaunchConfig::development(app_data_dir)?;
        Ok(Self {
            app,
            process: HermesProcessManager::new(config),
            storage,
            snapshot: Arc::new(Mutex::new(AgentSessionSnapshot::default())),
        })
    }

    pub async fn diagnostics(&self) -> HermesProcessDiagnostics {
        self.process.diagnostics().await
    }

    pub async fn snapshot(&self) -> AgentSessionSnapshot {
        let mut snapshot = self.snapshot.lock().await;
        snapshot.connection_status = self.process.diagnostics().await.status.into();
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
        if !current.temporary {
            if let Some(conversation_id) = current.local_conversation_id {
                self.storage
                    .run(move |connection, _| {
                        repository::delete_agent_session_link(connection, &conversation_id)
                    })
                    .await
                    .map_err(|error| error.to_string())?;
            }
        }
        {
            let mut snapshot = self.snapshot.lock().await;
            *snapshot = AgentSessionSnapshot::default();
            snapshot.connection_status = self.process.diagnostics().await.status.into();
        }
        self.broadcast_snapshot().await;
        Ok(self.snapshot().await)
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
        let _ = self.app.emit(AGENT_SESSION_SNAPSHOT_EVENT, snapshot);
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
