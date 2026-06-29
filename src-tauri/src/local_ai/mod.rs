pub mod client;
pub mod errors;
pub mod models;
pub mod stream;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use serde_json::Value;
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

use self::{
    client::OllamaClient,
    errors::LocalAiError,
    models::{LocalChatEvent, LocalChatRequest, LocalEmbeddingResult, LocalModel, ProviderMessage},
};

#[derive(Clone)]
pub struct LocalAiService {
    client: OllamaClient,
    active: Arc<Mutex<HashMap<String, ActiveRequest>>>,
}

#[derive(Clone)]
struct ActiveRequest {
    request_id: String,
    cancellation: CancellationToken,
}

impl LocalAiService {
    pub fn from_environment() -> Result<Self, LocalAiError> {
        Ok(Self {
            client: OllamaClient::from_environment()?,
            active: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn list_models(&self) -> Result<Vec<LocalModel>, LocalAiError> {
        self.client.list_models().await
    }

    pub fn has_active_generation(&self) -> bool {
        self.active
            .lock()
            .map(|active| !active.is_empty())
            .unwrap_or(true)
    }

    pub async fn structured_chat_with_schema(
        &self,
        model: &str,
        messages: &[ProviderMessage],
        schema: &Value,
    ) -> Result<String, LocalAiError> {
        if self.has_active_generation() {
            return Err(LocalAiError::invalid_request(
                "Visible conversation generation has priority.",
            ));
        }
        self.client
            .structured_chat_with_schema(model, messages, schema)
            .await
    }

    pub async fn embed(
        &self,
        model: &str,
        inputs: &[String],
    ) -> Result<LocalEmbeddingResult, LocalAiError> {
        if self.has_active_generation() {
            return Err(LocalAiError::invalid_request(
                "Visible conversation generation has priority.",
            ));
        }
        self.client.embed(model, inputs).await
    }

    pub async fn stream_chat(
        &self,
        request: LocalChatRequest,
        channel: Channel<LocalChatEvent>,
    ) -> Result<(), LocalAiError> {
        request.validate()?;
        let cancellation = CancellationToken::new();

        {
            let mut active = self.active.lock().map_err(|_| LocalAiError::internal())?;
            if active.contains_key(&request.conversation_id) {
                return Err(LocalAiError::invalid_request(
                    "A generation is already active for this conversation.",
                ));
            }
            active.insert(
                request.conversation_id.clone(),
                ActiveRequest {
                    request_id: request.request_id.clone(),
                    cancellation: cancellation.clone(),
                },
            );
        }

        let _guard = ActiveRequestGuard {
            active: Arc::clone(&self.active),
            conversation_id: request.conversation_id.clone(),
            request_id: request.request_id.clone(),
        };

        channel
            .send(LocalChatEvent::started(&request.request_id))
            .map_err(|error| LocalAiError::internal_with_detail(error.to_string()))?;

        self.client
            .stream_chat(request, cancellation, channel)
            .await
    }

    pub fn cancel(&self, request_id: &str) -> Result<(), LocalAiError> {
        validate_identifier(request_id, "request ID")?;
        let active = self.active.lock().map_err(|_| LocalAiError::internal())?;
        let request = active
            .values()
            .find(|request| request.request_id == request_id)
            .ok_or_else(LocalAiError::cancelled)?;
        request.cancellation.cancel();
        Ok(())
    }

    pub fn cancel_all(&self) {
        if let Ok(active) = self.active.lock() {
            for request in active.values() {
                request.cancellation.cancel();
            }
        }
    }
}

impl Drop for LocalAiService {
    fn drop(&mut self) {
        if Arc::strong_count(&self.active) == 1 {
            self.cancel_all();
        }
    }
}

struct ActiveRequestGuard {
    active: Arc<Mutex<HashMap<String, ActiveRequest>>>,
    conversation_id: String,
    request_id: String,
}

impl Drop for ActiveRequestGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = self.active.lock() {
            let should_remove = active
                .get(&self.conversation_id)
                .is_some_and(|request| request.request_id == self.request_id);
            if should_remove {
                active.remove(&self.conversation_id);
            }
        }
    }
}

pub(crate) fn validate_identifier(value: &str, label: &str) -> Result<(), LocalAiError> {
    let valid = !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_:.".contains(character));
    if valid {
        Ok(())
    } else {
        Err(LocalAiError::invalid_request(format!(
            "Invalid {label} supplied."
        )))
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use tokio_util::sync::CancellationToken;

    use super::{client::OllamaClient, validate_identifier, ActiveRequest, LocalAiService};

    #[test]
    fn validates_safe_identifiers() {
        assert!(validate_identifier("request-123:model", "request ID").is_ok());
    }

    #[test]
    fn rejects_unsafe_identifiers() {
        assert!(validate_identifier("../request", "request ID").is_err());
        assert!(validate_identifier("request id", "request ID").is_err());
    }

    #[test]
    fn cancellation_marks_active_request() {
        let token = CancellationToken::new();
        let service = LocalAiService {
            client: OllamaClient::new("http://127.0.0.1:11434").expect("valid endpoint"),
            active: Arc::new(Mutex::new(std::collections::HashMap::from([(
                "conversation-1".to_owned(),
                ActiveRequest {
                    request_id: "request-1".to_owned(),
                    cancellation: token.clone(),
                },
            )]))),
        };
        service.cancel("request-1").expect("request should cancel");
        assert!(token.is_cancelled());
    }

    #[test]
    fn dropping_a_worker_clone_does_not_cancel_visible_generation() {
        let token = CancellationToken::new();
        let service = LocalAiService {
            client: OllamaClient::new("http://127.0.0.1:11434").expect("valid endpoint"),
            active: Arc::new(Mutex::new(std::collections::HashMap::from([(
                "conversation-1".to_owned(),
                ActiveRequest {
                    request_id: "request-1".to_owned(),
                    cancellation: token.clone(),
                },
            )]))),
        };

        drop(service.clone());

        assert!(!token.is_cancelled());
        drop(service);
        assert!(token.is_cancelled());
    }
}
