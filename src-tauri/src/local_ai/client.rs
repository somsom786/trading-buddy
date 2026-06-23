use std::time::Duration;

use futures_util::StreamExt;
use reqwest::{Client, StatusCode};
use serde::Serialize;
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;
use url::{Host, Url};

use super::{
    errors::LocalAiError,
    models::{
        LocalChatEvent, LocalChatRequest, LocalModel, OllamaChatChunk, OllamaTagsResponse,
        ProviderMessage,
    },
    stream::NdjsonStreamParser,
};

const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:11434";
const ENDPOINT_ENV: &str = "TRADING_BUDDY_OLLAMA_ENDPOINT";

#[derive(Clone)]
pub struct OllamaClient {
    http: Client,
    endpoint: Url,
}

impl OllamaClient {
    pub fn from_environment() -> Result<Self, LocalAiError> {
        let configured = if cfg!(debug_assertions) {
            std::env::var(ENDPOINT_ENV).unwrap_or_else(|_| DEFAULT_ENDPOINT.to_owned())
        } else {
            DEFAULT_ENDPOINT.to_owned()
        };
        Self::new(&configured)
    }

    pub fn new(endpoint: &str) -> Result<Self, LocalAiError> {
        let endpoint = validate_loopback_endpoint(endpoint)?;
        let http = Client::builder()
            .connect_timeout(Duration::from_secs(2))
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|error| LocalAiError::internal_with_detail(error.to_string()))?;
        Ok(Self { http, endpoint })
    }

    pub async fn list_models(&self) -> Result<Vec<LocalModel>, LocalAiError> {
        let response = self
            .http
            .get(self.url("/api/tags")?)
            .send()
            .await
            .map_err(LocalAiError::from_reqwest)?;

        if !response.status().is_success() {
            return Err(map_error_response(response).await);
        }

        let tags: OllamaTagsResponse = response
            .json()
            .await
            .map_err(|error| LocalAiError::malformed(error.to_string()))?;
        if tags.models.is_empty() {
            return Err(LocalAiError::no_models());
        }
        Ok(tags.models.into_iter().map(LocalModel::from).collect())
    }

    pub async fn stream_chat(
        &self,
        request: LocalChatRequest,
        cancellation: CancellationToken,
        channel: Channel<LocalChatEvent>,
    ) -> Result<(), LocalAiError> {
        let body = OllamaChatBody {
            model: &request.model,
            messages: &request.messages,
            stream: true,
            think: request.think,
        };
        let response = tokio::select! {
            () = cancellation.cancelled() => {
                send_event(&channel, LocalChatEvent::Cancelled { request_id: request.request_id })?;
                return Ok(());
            }
            response = self.http.post(self.url("/api/chat")?).json(&body).send() => {
                response.map_err(LocalAiError::from_reqwest)?
            }
        };

        if !response.status().is_success() {
            let error = map_error_response(response).await;
            send_event(
                &channel,
                LocalChatEvent::Failed {
                    request_id: request.request_id,
                    error,
                },
            )?;
            return Ok(());
        }

        let mut stream = response.bytes_stream();
        let mut parser = NdjsonStreamParser::default();
        loop {
            let next = tokio::select! {
                () = cancellation.cancelled() => {
                    send_event(&channel, LocalChatEvent::Cancelled {
                        request_id: request.request_id.clone(),
                    })?;
                    return Ok(());
                }
                next = stream.next() => next,
            };

            let Some(chunk) = next else {
                if let Some(record) = parser.finish() {
                    if handle_record(record?, &request.request_id, &channel)? {
                        return Ok(());
                    }
                }
                let error =
                    LocalAiError::malformed("The Ollama stream ended before a done record.");
                send_event(
                    &channel,
                    LocalChatEvent::Failed {
                        request_id: request.request_id,
                        error,
                    },
                )?;
                return Ok(());
            };

            let chunk = chunk.map_err(LocalAiError::from_reqwest)?;
            for record in parser.push(&chunk) {
                match record {
                    Ok(record) => {
                        if handle_record(record, &request.request_id, &channel)? {
                            return Ok(());
                        }
                    }
                    Err(error) => {
                        send_event(
                            &channel,
                            LocalChatEvent::Failed {
                                request_id: request.request_id,
                                error,
                            },
                        )?;
                        return Ok(());
                    }
                }
            }
        }
    }

    fn url(&self, path: &str) -> Result<Url, LocalAiError> {
        self.endpoint
            .join(path)
            .map_err(|error| LocalAiError::internal_with_detail(error.to_string()))
    }
}

#[derive(Serialize)]
struct OllamaChatBody<'a> {
    model: &'a str,
    messages: &'a [ProviderMessage],
    stream: bool,
    think: bool,
}

fn handle_record(
    record: OllamaChatChunk,
    request_id: &str,
    channel: &Channel<LocalChatEvent>,
) -> Result<bool, LocalAiError> {
    if let Some(error) = record.error {
        send_event(
            channel,
            LocalChatEvent::Failed {
                request_id: request_id.to_owned(),
                error: LocalAiError::generation_failed(error),
            },
        )?;
        return Ok(true);
    }

    if let Some(message) = &record.message {
        if !message.content.is_empty() {
            send_event(
                channel,
                LocalChatEvent::ContentDelta {
                    request_id: request_id.to_owned(),
                    content: message.content.clone(),
                },
            )?;
        }
        if !message.thinking.is_empty() {
            send_event(
                channel,
                LocalChatEvent::ThinkingDelta {
                    request_id: request_id.to_owned(),
                    content: message.thinking.clone(),
                },
            )?;
        }
    }

    if record.done {
        send_event(
            channel,
            LocalChatEvent::Completed {
                request_id: request_id.to_owned(),
                metrics: Some(record.metrics()),
            },
        )?;
        return Ok(true);
    }
    Ok(false)
}

fn send_event(
    channel: &Channel<LocalChatEvent>,
    event: LocalChatEvent,
) -> Result<(), LocalAiError> {
    channel
        .send(event)
        .map_err(|error| LocalAiError::internal_with_detail(error.to_string()))
}

async fn map_error_response(response: reqwest::Response) -> LocalAiError {
    let status = response.status();
    let detail = response
        .text()
        .await
        .unwrap_or_else(|_| format!("Ollama returned HTTP {status}."));
    map_error_status(status, detail)
}

fn map_error_status(status: StatusCode, detail: String) -> LocalAiError {
    if status == StatusCode::NOT_FOUND && detail.to_ascii_lowercase().contains("model") {
        LocalAiError::model_unavailable(detail)
    } else {
        LocalAiError::generation_failed(format!("HTTP {status}: {detail}"))
    }
}

pub fn validate_loopback_endpoint(endpoint: &str) -> Result<Url, LocalAiError> {
    let mut url = Url::parse(endpoint)
        .map_err(|error| LocalAiError::invalid_request(format!("Invalid endpoint: {error}")))?;
    if url.scheme() != "http" || url.username() != "" || url.password().is_some() {
        return Err(LocalAiError::invalid_request(
            "The Ollama endpoint must be an unauthenticated HTTP loopback URL.",
        ));
    }
    let loopback = match url.host() {
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        Some(Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        None => false,
    };
    if !loopback {
        return Err(LocalAiError::invalid_request(
            "Remote Ollama endpoints are not allowed.",
        ));
    }
    if url.port().is_none() {
        return Err(LocalAiError::invalid_request(
            "The Ollama endpoint must include an explicit port.",
        ));
    }
    url.set_path("/");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

#[cfg(test)]
mod tests {
    use reqwest::StatusCode;

    use super::{map_error_status, validate_loopback_endpoint};
    use crate::local_ai::errors::LocalAiErrorCode;
    use crate::local_ai::models::{LocalModel, OllamaTagsResponse};

    #[test]
    fn accepts_loopback_endpoints() {
        assert!(validate_loopback_endpoint("http://127.0.0.1:11434").is_ok());
        assert!(validate_loopback_endpoint("http://[::1]:11434").is_ok());
        assert!(validate_loopback_endpoint("http://localhost:11434").is_ok());
    }

    #[test]
    fn rejects_remote_or_insecure_endpoints() {
        assert!(validate_loopback_endpoint("https://127.0.0.1:11434").is_err());
        assert!(validate_loopback_endpoint("http://192.168.1.2:11434").is_err());
        assert!(validate_loopback_endpoint("http://example.com:11434").is_err());
        assert!(validate_loopback_endpoint("http://127.0.0.1").is_err());
    }

    #[test]
    fn parses_model_list_response() {
        let response: OllamaTagsResponse = serde_json::from_value(serde_json::json!({
            "models": [{
                "name": "qwen3:4b",
                "modified_at": "2026-01-01T00:00:00Z",
                "size": 1234,
                "details": {
                    "family": "qwen3",
                    "parameter_size": "4B",
                    "quantization_level": "Q4_K_M"
                }
            }]
        }))
        .expect("fixture should parse");
        let model = LocalModel::from(response.models.into_iter().next().expect("model"));
        assert_eq!(model.name, "qwen3:4b");
        assert_eq!(model.parameter_size.as_deref(), Some("4B"));
    }

    #[test]
    fn maps_missing_model_errors() {
        let error = map_error_status(
            StatusCode::NOT_FOUND,
            r#"{"error":"model 'missing' not found"}"#.to_owned(),
        );
        assert_eq!(error.code, LocalAiErrorCode::SelectedModelUnavailable);
    }

    #[test]
    fn maps_general_http_errors() {
        let error = map_error_status(StatusCode::INTERNAL_SERVER_ERROR, "failure".to_owned());
        assert_eq!(error.code, LocalAiErrorCode::GenerationFailed);
    }
}
