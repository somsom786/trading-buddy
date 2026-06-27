use serde::{Deserialize, Serialize};

use super::{errors::LocalAiError, validate_identifier};

const MAX_MESSAGES: usize = 100;
const MAX_MESSAGE_LENGTH: usize = 12_000;
const MAX_TOTAL_LENGTH: usize = 50_000;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantization_level: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalChatRequest {
    pub request_id: String,
    pub conversation_id: String,
    pub model: String,
    pub messages: Vec<ProviderMessage>,
    #[serde(default)]
    pub think: bool,
}

impl LocalChatRequest {
    pub fn validate(&self) -> Result<(), LocalAiError> {
        validate_identifier(&self.request_id, "request ID")?;
        validate_identifier(&self.conversation_id, "conversation ID")?;
        validate_model_name(&self.model)?;
        if self.messages.is_empty() || self.messages.len() > MAX_MESSAGES {
            return Err(LocalAiError::invalid_request(
                "A request must contain between 1 and 100 messages.",
            ));
        }

        let mut total_length = 0usize;
        for message in &self.messages {
            if message.content.trim().is_empty() || message.content.len() > MAX_MESSAGE_LENGTH {
                return Err(LocalAiError::invalid_request(
                    "Each message must contain text within the allowed length.",
                ));
            }
            total_length = total_length.saturating_add(message.content.len());
        }
        if total_length > MAX_TOTAL_LENGTH {
            return Err(LocalAiError::invalid_request(
                "The conversation is too long for one local request.",
            ));
        }
        Ok(())
    }
}

pub fn validate_model_name(model: &str) -> Result<(), LocalAiError> {
    let valid = !model.is_empty()
        && model.len() <= 128
        && !model.contains("://")
        && !model.starts_with(['.', '/'])
        && model
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._-:/".contains(character));
    if valid {
        Ok(())
    } else {
        Err(LocalAiError::invalid_request(
            "The selected model name contains unsupported characters.",
        ))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum LocalChatEvent {
    Started {
        request_id: String,
    },
    ContentDelta {
        request_id: String,
        content: String,
    },
    ThinkingDelta {
        request_id: String,
        content: String,
    },
    Completed {
        request_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        metrics: Option<GenerationMetrics>,
    },
    Failed {
        request_id: String,
        error: LocalAiError,
    },
    Cancelled {
        request_id: String,
    },
}

impl LocalChatEvent {
    pub fn started(request_id: &str) -> Self {
        Self::Started {
            request_id: request_id.to_owned(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationMetrics {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_duration_ns: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub load_duration_ns: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_eval_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_eval_duration_ns: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eval_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eval_duration_ns: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct OllamaTagsResponse {
    #[serde(default)]
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: Option<String>,
    pub size: Option<u64>,
    pub details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
pub struct OllamaModelDetails {
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

impl From<OllamaModel> for LocalModel {
    fn from(model: OllamaModel) -> Self {
        let details = model.details;
        Self {
            name: model.name,
            modified_at: model.modified_at,
            size_bytes: model.size,
            family: details.as_ref().and_then(|value| value.family.clone()),
            parameter_size: details
                .as_ref()
                .and_then(|value| value.parameter_size.clone()),
            quantization_level: details.and_then(|value| value.quantization_level),
        }
    }
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct OllamaChatChunk {
    pub message: Option<OllamaResponseMessage>,
    #[serde(default)]
    pub done: bool,
    pub error: Option<String>,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<u64>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<u64>,
    pub eval_duration: Option<u64>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct OllamaResponseMessage {
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub thinking: String,
}

#[derive(Debug, Deserialize)]
pub struct OllamaChatResponse {
    pub message: OllamaResponseMessage,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Deserialize)]
pub struct OllamaEmbedResponse {
    pub model: String,
    pub embeddings: Vec<Vec<f32>>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalEmbeddingResult {
    pub model: String,
    pub dimension: usize,
    pub vectors: Vec<Vec<f32>>,
}

impl OllamaChatChunk {
    pub fn metrics(&self) -> GenerationMetrics {
        GenerationMetrics {
            total_duration_ns: self.total_duration,
            load_duration_ns: self.load_duration,
            prompt_eval_count: self.prompt_eval_count,
            prompt_eval_duration_ns: self.prompt_eval_duration,
            eval_count: self.eval_count,
            eval_duration_ns: self.eval_duration,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_model_name, LocalChatRequest, ProviderMessage};

    #[test]
    fn accepts_standard_ollama_model_names() {
        assert!(validate_model_name("qwen3:4b").is_ok());
        assert!(validate_model_name("library/model-name:latest").is_ok());
    }

    #[test]
    fn rejects_invalid_model_names() {
        assert!(validate_model_name("qwen model").is_err());
        assert!(validate_model_name("http://remote/model").is_err());
    }

    #[test]
    fn rejects_empty_messages() {
        let request: LocalChatRequest = serde_json::from_value(serde_json::json!({
            "requestId": "request-1",
            "conversationId": "conversation-1",
            "model": "qwen3:4b",
            "messages": [{"role": "user", "content": "   "}]
        }))
        .expect("fixture should deserialize");
        assert!(request.validate().is_err());
    }

    #[test]
    fn provider_message_serializes_for_ollama() {
        let message: ProviderMessage = serde_json::from_value(serde_json::json!({
            "role": "assistant",
            "content": "Hello"
        }))
        .expect("fixture should deserialize");
        assert_eq!(message.content, "Hello");
    }
}
