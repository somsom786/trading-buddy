use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiError {
    pub code: LocalAiErrorCode,
    pub user_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub technical_message: Option<String>,
    pub retryable: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LocalAiErrorCode {
    OllamaNotRunning,
    NoModelsInstalled,
    SelectedModelUnavailable,
    ConnectionTimeout,
    RequestCancelled,
    MalformedOllamaResponse,
    GenerationFailed,
    InvalidFrontendRequest,
    InternalApplicationError,
}

impl LocalAiError {
    pub fn ollama_not_running(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::OllamaNotRunning,
            "Ollama is not running. Start Ollama and try again.",
            Some(detail.into()),
            true,
        )
    }

    pub fn no_models() -> Self {
        Self::new(
            LocalAiErrorCode::NoModelsInstalled,
            "Ollama is connected, but no local models are installed.",
            None,
            true,
        )
    }

    pub fn model_unavailable(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::SelectedModelUnavailable,
            "The selected model is not available locally.",
            Some(detail.into()),
            true,
        )
    }

    pub fn timeout(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::ConnectionTimeout,
            "The local model took too long to respond.",
            Some(detail.into()),
            true,
        )
    }

    pub fn cancelled() -> Self {
        Self::new(
            LocalAiErrorCode::RequestCancelled,
            "Generation was cancelled.",
            None,
            false,
        )
    }

    pub fn malformed(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::MalformedOllamaResponse,
            "Ollama returned a response Trading Buddy could not read.",
            Some(detail.into()),
            true,
        )
    }

    pub fn generation_failed(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::GenerationFailed,
            "The local model could not complete the response.",
            Some(detail.into()),
            true,
        )
    }

    pub fn invalid_request(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::InvalidFrontendRequest,
            "The local chat request was invalid.",
            Some(detail.into()),
            false,
        )
    }

    pub fn internal() -> Self {
        Self::internal_with_detail("Internal application state was unavailable.")
    }

    pub fn internal_with_detail(detail: impl Into<String>) -> Self {
        Self::new(
            LocalAiErrorCode::InternalApplicationError,
            "Trading Buddy encountered an internal error.",
            Some(detail.into()),
            true,
        )
    }

    pub fn from_reqwest(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            return Self::timeout(error.to_string());
        }
        if error.is_connect() {
            return Self::ollama_not_running(error.to_string());
        }
        Self::generation_failed(error.to_string())
    }

    fn new(
        code: LocalAiErrorCode,
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

impl std::fmt::Display for LocalAiError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.user_message)
    }
}

impl std::error::Error for LocalAiError {}
