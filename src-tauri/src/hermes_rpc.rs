use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_GATEWAY_LINE_BYTES: usize = 256 * 1024;
pub const RPC_TIMEOUT_SECONDS: u64 = 30;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HermesMethod {
    SessionCreate,
    SessionResume,
    SessionList,
    SessionHistory,
    SessionStatus,
    PromptSubmit,
    SessionInterrupt,
    SessionClose,
    TradingBuddySessionDelete,
}

impl HermesMethod {
    const ALL: [Self; 9] = [
        Self::SessionCreate,
        Self::SessionResume,
        Self::SessionList,
        Self::SessionHistory,
        Self::SessionStatus,
        Self::PromptSubmit,
        Self::SessionInterrupt,
        Self::SessionClose,
        Self::TradingBuddySessionDelete,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::SessionCreate => "session.create",
            Self::SessionResume => "session.resume",
            Self::SessionList => "session.list",
            Self::SessionHistory => "session.history",
            Self::SessionStatus => "session.status",
            Self::PromptSubmit => "prompt.submit",
            Self::SessionInterrupt => "session.interrupt",
            Self::SessionClose => "session.close",
            Self::TradingBuddySessionDelete => "trading_buddy.session_delete",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct GatewayEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub payload: Option<Value>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum GatewayFrame {
    Response {
        id: String,
        result: Result<Value, GatewayRpcError>,
    },
    Event(GatewayEvent),
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct GatewayRpcError {
    pub code: i64,
    pub message: String,
}

pub fn request_frame(id: &str, method: HermesMethod, params: Value) -> Value {
    debug_assert!(HermesMethod::ALL.contains(&method));
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method.as_str(),
        "params": params,
    })
}

pub fn parse_gateway_line(line: &[u8]) -> Result<GatewayFrame, GatewayRpcError> {
    if line.is_empty() || line.len() > MAX_GATEWAY_LINE_BYTES {
        return Err(protocol_error("Gateway frame size is invalid."));
    }
    let value: Value = serde_json::from_slice(line)
        .map_err(|_| protocol_error("Gateway emitted invalid JSON."))?;
    let object = value
        .as_object()
        .ok_or_else(|| protocol_error("Gateway frame must be an object."))?;
    if object.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Err(protocol_error(
            "Gateway frame has an invalid JSON-RPC version.",
        ));
    }
    if object.get("method").and_then(Value::as_str) == Some("event") {
        let params = object
            .get("params")
            .cloned()
            .ok_or_else(|| protocol_error("Gateway event is missing params."))?;
        let event: GatewayEvent = serde_json::from_value(params)
            .map_err(|_| protocol_error("Gateway event payload is invalid."))?;
        if event.event_type.is_empty() || event.event_type.len() > 128 {
            return Err(protocol_error("Gateway event type is invalid."));
        }
        return Ok(GatewayFrame::Event(event));
    }

    let id = object
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty() && id.len() <= 128)
        .ok_or_else(|| protocol_error("Gateway response has an invalid request ID."))?
        .to_owned();
    if let Some(error) = object.get("error") {
        let parsed: GatewayRpcError = serde_json::from_value(error.clone())
            .map_err(|_| protocol_error("Gateway error response is invalid."))?;
        return Ok(GatewayFrame::Response {
            id,
            result: Err(GatewayRpcError {
                code: parsed.code,
                message: sanitize_error_message(&parsed.message),
            }),
        });
    }
    let result = object
        .get("result")
        .cloned()
        .ok_or_else(|| protocol_error("Gateway response is missing a result."))?;
    Ok(GatewayFrame::Response {
        id,
        result: Ok(result),
    })
}

pub fn sanitize_error_message(message: &str) -> String {
    let single_line = message
        .replace(['\r', '\n', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if single_line.is_empty() {
        "Local agent request failed.".to_owned()
    } else {
        single_line.chars().take(500).collect()
    }
}

fn protocol_error(message: &str) -> GatewayRpcError {
    GatewayRpcError {
        code: -32_000,
        message: message.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        parse_gateway_line, request_frame, GatewayFrame, HermesMethod, MAX_GATEWAY_LINE_BYTES,
    };

    #[test]
    fn builds_only_typed_allowlisted_requests() {
        assert_eq!(
            request_frame(
                "rpc-1",
                HermesMethod::SessionCreate,
                json!({"source": "trading_buddy"})
            ),
            json!({
                "jsonrpc": "2.0",
                "id": "rpc-1",
                "method": "session.create",
                "params": {"source": "trading_buddy"}
            })
        );
    }

    #[test]
    fn companion_rpc_allowlist_excludes_side_effect_and_capture_methods() {
        let methods = HermesMethod::ALL.map(HermesMethod::as_str);
        for prohibited in [
            "shell",
            "filesystem",
            "browser",
            "clipboard",
            "screen",
            "wallet",
            "sign",
        ] {
            assert!(
                methods.iter().all(|method| !method.contains(prohibited)),
                "prohibited companion RPC method: {prohibited}"
            );
        }
    }

    #[test]
    fn parses_responses_and_events_without_raw_passthrough() {
        let response = br#"{"jsonrpc":"2.0","id":"rpc-1","result":{"session_id":"live-1"}}"#;
        assert!(matches!(
            parse_gateway_line(response).expect("response"),
            GatewayFrame::Response { id, result: Ok(_) } if id == "rpc-1"
        ));
        let event = br#"{"jsonrpc":"2.0","method":"event","params":{"type":"message.delta","session_id":"live-1","payload":{"text":"hi"}}}"#;
        assert!(matches!(
            parse_gateway_line(event).expect("event"),
            GatewayFrame::Event(event) if event.event_type == "message.delta"
        ));
    }

    #[test]
    fn rejects_malformed_and_oversized_lines() {
        assert!(parse_gateway_line(b"not-json").is_err());
        assert!(parse_gateway_line(&vec![b'x'; MAX_GATEWAY_LINE_BYTES + 1]).is_err());
    }
}
