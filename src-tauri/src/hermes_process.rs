use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicU32, AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::{broadcast, mpsc, oneshot, watch, Mutex},
    time::{interval, timeout},
};

use crate::hermes_rpc::{
    parse_gateway_line, request_frame, GatewayEvent, GatewayFrame, GatewayRpcError, HermesMethod,
    MAX_GATEWAY_LINE_BYTES, RPC_TIMEOUT_SECONDS,
};

pub const COMPANION_MODEL: &str = "deepseek-ai/deepseek-v4-pro";
pub const COMPANION_PROVIDER: &str = "custom:trading-buddy-nvidia";
const NVIDIA_API_KEY_ENV: &str = "NVIDIA_API_KEY";
const NVIDIA_API_KEY_FILE_ENV: &str = "TRADING_BUDDY_NVIDIA_API_KEY_FILE";
const COMPANION_CONFIG: &str = r#"_config_version: 32
custom_providers:
  - name: trading-buddy-nvidia
    provider_key: trading-buddy-nvidia
    base_url: https://integrate.api.nvidia.com/v1
    key_env: NVIDIA_API_KEY
    api_mode: chat_completions
    model: deepseek-ai/deepseek-v4-pro
    max_output_tokens: 16384
    extra_body:
      temperature: 1
      top_p: 0.95
      chat_template_kwargs:
        thinking: false
model:
  default: deepseek-ai/deepseek-v4-pro
  provider: custom:trading-buddy-nvidia
  context_length: 1000000
  max_tokens: 16384
fallback_providers: []
toolsets:
  - trading-buddy-companion
display:
  interface: cli
"#;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HermesRuntimeStatus {
    Stopped,
    Starting,
    Ready,
    Reconnecting,
    Offline,
    Failed,
    Stopping,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HermesProcessDiagnostics {
    pub status: HermesRuntimeStatus,
    pub process_id: Option<u32>,
    pub restart_count: u32,
    pub last_error: Option<String>,
    pub gateway_spawn_ms: Option<u64>,
    pub gateway_ready_ms: Option<u64>,
}

#[derive(Clone, Debug)]
pub struct GatewayLaunchConfig {
    pub project_root: PathBuf,
    pub agent_root: PathBuf,
    pub python: PathBuf,
    pub hermes_home: PathBuf,
    credential_file_candidates: Vec<PathBuf>,
}

impl GatewayLaunchConfig {
    pub fn development(app_data_dir: &Path) -> Result<Self, String> {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let project_root = manifest
            .parent()
            .ok_or_else(|| "Trading Buddy project root is unavailable.".to_owned())?
            .to_path_buf();
        let agent_root = project_root.join("next").join("agent");
        let python = agent_root.join("venv").join("Scripts").join("python.exe");
        Ok(Self {
            credential_file_candidates: vec![
                app_data_dir.join("nvidia-api.txt"),
                project_root.join("nvidia-api.txt"),
            ],
            project_root,
            agent_root,
            python,
            hermes_home: app_data_dir.join("hermes-runtime"),
        })
    }

    fn prepare_home(&self) -> Result<(), String> {
        if !self
            .agent_root
            .join("tui_gateway")
            .join("entry.py")
            .is_file()
        {
            return Err("The pinned Hermes gateway submodule is unavailable.".to_owned());
        }
        if !self.python.is_file() {
            return Err(
                "The pinned Hermes Python environment is unavailable. Run the documented setup."
                    .to_owned(),
            );
        }
        std::fs::create_dir_all(&self.hermes_home).map_err(|error| error.to_string())?;
        let config_path = self.hermes_home.join("config.yaml");
        std::fs::write(&config_path, COMPANION_CONFIG).map_err(|error| error.to_string())?;
        let soul_target = self.hermes_home.join("SOUL.md");
        if !soul_target.exists() {
            let soul_source = self
                .project_root
                .join("next")
                .join("packages")
                .join("trading-buddy-soul")
                .join("SOUL.md");
            std::fs::copy(soul_source, soul_target).map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    fn load_nvidia_api_key(&self) -> Result<String, String> {
        if let Ok(value) = std::env::var(NVIDIA_API_KEY_ENV) {
            return extract_nvidia_api_key(&value);
        }
        if let Ok(value) = std::env::var(NVIDIA_API_KEY_FILE_ENV) {
            let path = PathBuf::from(value);
            return read_nvidia_api_key(&path);
        }
        for path in &self.credential_file_candidates {
            if path.is_file() {
                return read_nvidia_api_key(path);
            }
        }
        Err(
            "NVIDIA API key is not configured. Set NVIDIA_API_KEY or use the ignored nvidia-api.txt development file."
                .to_owned(),
        )
    }
}

fn read_nvidia_api_key(path: &Path) -> Result<String, String> {
    let contents = std::fs::read_to_string(path)
        .map_err(|_| "The configured NVIDIA API key file could not be read.".to_owned())?;
    extract_nvidia_api_key(&contents)
}

fn extract_nvidia_api_key(contents: &str) -> Result<String, String> {
    let mut candidates = Vec::new();
    let mut remainder = contents;
    while let Some(offset) = remainder.find("nvapi-") {
        let candidate = &remainder[offset..];
        let end = candidate
            .find(|character: char| {
                !(character.is_ascii_alphanumeric() || character == '-' || character == '_')
            })
            .unwrap_or(candidate.len());
        let token = &candidate[..end];
        if (16..=512).contains(&token.len()) && !candidates.contains(&token) {
            candidates.push(token);
        }
        remainder = &candidate[end..];
        if end == 0 {
            break;
        }
    }
    match candidates.as_slice() {
        [token] => Ok((*token).to_owned()),
        [] => Err("The NVIDIA API key is missing or malformed.".to_owned()),
        _ => Err("The NVIDIA API key file contains multiple credentials.".to_owned()),
    }
}

#[derive(Clone)]
pub struct HermesProcessManager {
    config: GatewayLaunchConfig,
    state: Arc<Mutex<ManagerState>>,
    status: watch::Sender<HermesRuntimeStatus>,
    events: broadcast::Sender<GatewayEvent>,
    next_id: Arc<AtomicU64>,
    process_id: Arc<AtomicU32>,
}

struct ManagerState {
    sender: Option<mpsc::Sender<ActorCommand>>,
    restart_count: u32,
    last_error: Option<String>,
    gateway_spawn_ms: Option<u64>,
    gateway_ready_ms: Option<u64>,
}

enum ActorCommand {
    Request {
        id: String,
        method: HermesMethod,
        params: Value,
        reply: oneshot::Sender<Result<Value, GatewayRpcError>>,
    },
    Forget {
        id: String,
    },
    Stop {
        reply: oneshot::Sender<()>,
    },
}

enum ReaderMessage {
    Frame(GatewayFrame),
    Invalid(String),
    Eof,
}

struct ActorIo {
    child: Child,
    stdin: tokio::process::ChildStdin,
    stdout: tokio::process::ChildStdout,
    stderr: tokio::process::ChildStderr,
}

impl HermesProcessManager {
    pub fn new(config: GatewayLaunchConfig) -> Self {
        let (status, _) = watch::channel(HermesRuntimeStatus::Stopped);
        let (events, _) = broadcast::channel(256);
        Self {
            config,
            state: Arc::new(Mutex::new(ManagerState {
                sender: None,
                restart_count: 0,
                last_error: None,
                gateway_spawn_ms: None,
                gateway_ready_ms: None,
            })),
            status,
            events,
            next_id: Arc::new(AtomicU64::new(1)),
            process_id: Arc::new(AtomicU32::new(0)),
        }
    }

    pub async fn diagnostics(&self) -> HermesProcessDiagnostics {
        let state = self.state.lock().await;
        let pid = self.process_id.load(Ordering::Relaxed);
        HermesProcessDiagnostics {
            status: *self.status.borrow(),
            process_id: (pid != 0).then_some(pid),
            restart_count: state.restart_count,
            last_error: state.last_error.clone(),
            gateway_spawn_ms: state.gateway_spawn_ms,
            gateway_ready_ms: state.gateway_ready_ms,
        }
    }

    pub fn subscribe_events(&self) -> broadcast::Receiver<GatewayEvent> {
        self.events.subscribe()
    }

    pub fn subscribe_status(&self) -> watch::Receiver<HermesRuntimeStatus> {
        self.status.subscribe()
    }

    pub async fn start(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;
        if state
            .sender
            .as_ref()
            .is_some_and(|sender| !sender.is_closed())
        {
            return Ok(());
        }
        state.sender = None;
        state.gateway_spawn_ms = None;
        state.gateway_ready_ms = None;
        let gateway_started_at = Instant::now();
        self.config.prepare_home()?;
        let nvidia_api_key = self.config.load_nvidia_api_key()?;
        let _ = self.status.send(HermesRuntimeStatus::Starting);

        let mut command = Command::new(&self.config.python);
        command
            .arg("-m")
            .arg("tui_gateway.entry")
            .current_dir(&self.config.agent_root)
            .env("HERMES_HOME", &self.config.hermes_home)
            .env("HERMES_TUI_TOOLSETS", "trading-buddy-companion")
            .env("TRADING_BUDDY_COMPANION", "1")
            .env(NVIDIA_API_KEY_ENV, nvidia_api_key)
            .env_remove("HERMES_TUI_SIDECAR_URL")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.as_std_mut().creation_flags(0x0800_0000);
        }
        let mut child = command.spawn().map_err(|error| {
            let message = format!("Could not start the companion runtime: {error}");
            let _ = self.status.send(HermesRuntimeStatus::Failed);
            message
        })?;
        let pid = child.id().unwrap_or(0);
        state.gateway_spawn_ms = Some(duration_millis(gateway_started_at.elapsed()));
        self.process_id.store(pid, Ordering::Relaxed);
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Gateway stdin is unavailable.".to_owned())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Gateway stdout is unavailable.".to_owned())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Gateway stderr is unavailable.".to_owned())?;
        let (sender, receiver) = mpsc::channel(128);
        state.sender = Some(sender);
        let mut ready_events = self.events.subscribe();
        let status = self.status.clone();
        let events = self.events.clone();
        let process_id = Arc::clone(&self.process_id);
        tokio::spawn(run_actor(
            ActorIo {
                child,
                stdin,
                stdout,
                stderr,
            },
            receiver,
            status,
            events,
            process_id,
        ));
        drop(state);

        match timeout(Duration::from_secs(15), async {
            loop {
                let event = ready_events
                    .recv()
                    .await
                    .map_err(|_| "Gateway ready event channel closed.".to_owned())?;
                if event.event_type == "gateway.ready" {
                    return Ok::<(), String>(());
                }
            }
        })
        .await
        {
            Ok(result) => {
                result?;
                self.state.lock().await.gateway_ready_ms =
                    Some(duration_millis(gateway_started_at.elapsed()));
                let _ = self.status.send(HermesRuntimeStatus::Ready);
                Ok(())
            }
            Err(_) => {
                self.record_failure("Companion runtime did not become ready in time.")
                    .await;
                let _ = self.stop().await;
                Err("Companion runtime did not become ready in time.".to_owned())
            }
        }
    }

    pub async fn request(
        &self,
        method: HermesMethod,
        params: Value,
    ) -> Result<Value, GatewayRpcError> {
        self.start().await.map_err(|message| GatewayRpcError {
            code: -32_001,
            message,
        })?;
        let sender = {
            let state = self.state.lock().await;
            state.sender.clone()
        }
        .ok_or_else(|| GatewayRpcError {
            code: -32_001,
            message: "Local agent gateway is not running.".to_owned(),
        })?;
        let id = format!("tb-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let (reply, receiver) = oneshot::channel();
        sender
            .send(ActorCommand::Request {
                id: id.clone(),
                method,
                params,
                reply,
            })
            .await
            .map_err(|_| GatewayRpcError {
                code: -32_001,
                message: "Local agent gateway stopped.".to_owned(),
            })?;
        match timeout(Duration::from_secs(RPC_TIMEOUT_SECONDS), receiver).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(GatewayRpcError {
                code: -32_001,
                message: "Local agent gateway stopped.".to_owned(),
            }),
            Err(_) => {
                let _ = sender.send(ActorCommand::Forget { id }).await;
                Err(GatewayRpcError {
                    code: -32_002,
                    message: "Local agent request timed out.".to_owned(),
                })
            }
        }
    }

    pub async fn stop(&self) -> Result<(), String> {
        let sender = {
            let state = self.state.lock().await;
            state.sender.clone()
        };
        let Some(sender) = sender else {
            let _ = self.status.send(HermesRuntimeStatus::Stopped);
            return Ok(());
        };
        let _ = self.status.send(HermesRuntimeStatus::Stopping);
        let (reply, receiver) = oneshot::channel();
        if sender.send(ActorCommand::Stop { reply }).await.is_ok() {
            let _ = timeout(Duration::from_secs(3), receiver).await;
        }
        let mut state = self.state.lock().await;
        state.sender = None;
        self.process_id.store(0, Ordering::Relaxed);
        let _ = self.status.send(HermesRuntimeStatus::Stopped);
        Ok(())
    }

    pub async fn explicit_restart(&self) -> Result<(), String> {
        {
            let mut state = self.state.lock().await;
            state.restart_count = state.restart_count.saturating_add(1);
        }
        let _ = self.status.send(HermesRuntimeStatus::Reconnecting);
        self.stop().await?;
        self.start().await
    }

    pub async fn recover_bounded(&self) -> Result<(), String> {
        const BACKOFFS: [Duration; 3] = [
            Duration::from_millis(250),
            Duration::from_secs(1),
            Duration::from_secs(3),
        ];
        let mut last_error = "Local agent gateway is offline.".to_owned();
        for backoff in BACKOFFS {
            let _ = self.status.send(HermesRuntimeStatus::Reconnecting);
            tokio::time::sleep(backoff).await;
            {
                let mut state = self.state.lock().await;
                state.restart_count = state.restart_count.saturating_add(1);
            }
            match self.start().await {
                Ok(()) => return Ok(()),
                Err(error) => {
                    last_error = error;
                }
            }
        }
        self.record_failure(&last_error).await;
        Err(last_error)
    }

    async fn record_failure(&self, message: &str) {
        let mut state = self.state.lock().await;
        state.last_error = Some(message.chars().take(500).collect());
        let _ = self.status.send(HermesRuntimeStatus::Failed);
    }
}

fn duration_millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

async fn run_actor(
    io: ActorIo,
    mut commands: mpsc::Receiver<ActorCommand>,
    status: watch::Sender<HermesRuntimeStatus>,
    events: broadcast::Sender<GatewayEvent>,
    process_id: Arc<AtomicU32>,
) {
    let ActorIo {
        mut child,
        mut stdin,
        stdout,
        stderr,
    } = io;
    let (reader_sender, mut reader) = mpsc::channel(128);
    tokio::spawn(read_stdout(stdout, reader_sender.clone()));
    tokio::spawn(read_stderr(stderr));
    let mut pending: HashMap<String, oneshot::Sender<Result<Value, GatewayRpcError>>> =
        HashMap::new();
    let mut process_poll = interval(Duration::from_millis(200));
    let mut intentional_stop = false;

    loop {
        tokio::select! {
            command = commands.recv() => {
                match command {
                    Some(ActorCommand::Request { id, method, params, reply }) => {
                        let frame = request_frame(&id, method, params);
                        let mut encoded = match serde_json::to_vec(&frame) {
                            Ok(encoded) if encoded.len() <= MAX_GATEWAY_LINE_BYTES => encoded,
                            _ => {
                                let _ = reply.send(Err(GatewayRpcError {
                                    code: -32_000,
                                    message: "Local agent request is too large.".to_owned(),
                                }));
                                continue;
                            }
                        };
                        encoded.push(b'\n');
                        if stdin.write_all(&encoded).await.is_err() || stdin.flush().await.is_err() {
                            let _ = reply.send(Err(GatewayRpcError {
                                code: -32_001,
                                message: "Local agent gateway input closed.".to_owned(),
                            }));
                            break;
                        }
                        pending.insert(id, reply);
                    }
                    Some(ActorCommand::Forget { id }) => {
                        pending.remove(&id);
                    }
                    Some(ActorCommand::Stop { reply }) => {
                        intentional_stop = true;
                        let _ = stdin.shutdown().await;
                        if timeout(Duration::from_secs(1), child.wait()).await.is_err() {
                            let _ = child.kill().await;
                            let _ = child.wait().await;
                        }
                        let _ = reply.send(());
                        break;
                    }
                    None => break,
                }
            }
            message = reader.recv() => {
                match message {
                    Some(ReaderMessage::Frame(GatewayFrame::Response { id, result })) => {
                        if let Some(reply) = pending.remove(&id) {
                            let _ = reply.send(result);
                        }
                    }
                    Some(ReaderMessage::Frame(GatewayFrame::Event(event))) => {
                        let _ = events.send(event);
                    }
                    Some(ReaderMessage::Invalid(message)) => {
                        for (_, reply) in pending.drain() {
                            let _ = reply.send(Err(GatewayRpcError {
                                code: -32_000,
                                message: message.clone(),
                            }));
                        }
                        break;
                    }
                    Some(ReaderMessage::Eof) | None => break,
                }
            }
            _ = process_poll.tick() => {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => {}
                    Err(_) => break,
                }
            }
        }
    }

    for (_, reply) in pending.drain() {
        let _ = reply.send(Err(GatewayRpcError {
            code: -32_001,
            message: "Local agent gateway stopped.".to_owned(),
        }));
    }
    if !intentional_stop {
        let _ = child.kill().await;
        let _ = child.wait().await;
    }
    process_id.store(0, Ordering::Relaxed);
    let _ = status.send(if intentional_stop {
        HermesRuntimeStatus::Stopped
    } else {
        HermesRuntimeStatus::Offline
    });
}

async fn read_stdout(stdout: tokio::process::ChildStdout, sender: mpsc::Sender<ReaderMessage>) {
    let mut reader = BufReader::new(stdout);
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line).await {
            Ok(0) => {
                let _ = sender.send(ReaderMessage::Eof).await;
                return;
            }
            Ok(_) => {
                while matches!(line.last(), Some(b'\n' | b'\r')) {
                    line.pop();
                }
                if line.len() > MAX_GATEWAY_LINE_BYTES {
                    let _ = sender
                        .send(ReaderMessage::Invalid(
                            "Local agent gateway emitted an oversized frame.".to_owned(),
                        ))
                        .await;
                    return;
                }
                match parse_gateway_line(&line) {
                    Ok(frame) => {
                        if sender.send(ReaderMessage::Frame(frame)).await.is_err() {
                            return;
                        }
                    }
                    Err(error) => {
                        let _ = sender.send(ReaderMessage::Invalid(error.message)).await;
                        return;
                    }
                }
            }
            Err(_) => {
                let _ = sender
                    .send(ReaderMessage::Invalid(
                        "Local agent gateway output could not be read.".to_owned(),
                    ))
                    .await;
                return;
            }
        }
    }
}

async fn read_stderr(stderr: tokio::process::ChildStderr) {
    let mut reader = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        if !line.trim().is_empty() {
            eprintln!(
                "[trading-buddy agent] gateway diagnostic ({} characters)",
                line.chars().count().min(10_000)
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use serde_json::json;
    use tempfile::TempDir;
    use tokio::time::{timeout, Duration};

    use crate::hermes_rpc::HermesMethod;

    use super::{GatewayLaunchConfig, HermesProcessManager, HermesRuntimeStatus};

    #[test]
    fn extracts_one_nvidia_key_without_persisting_it() {
        let token = format!("{}{}", "nvapi-", "development-token-123456");
        let source = format!("client = Example(api_key = \"{token}\")");
        let key = super::extract_nvidia_api_key(&source).expect("one credential");
        assert_eq!(key, token);
    }

    #[test]
    fn rejects_missing_or_ambiguous_nvidia_keys() {
        assert!(super::extract_nvidia_api_key("not a credential").is_err());
        let first = format!("{}{}", "nvapi-", "development-token-123456");
        let second = format!("{}{}", "nvapi-", "second-token-123456");
        assert!(super::extract_nvidia_api_key(&format!("{first} {second}")).is_err());
    }

    #[test]
    fn locates_the_pinned_development_gateway_without_network_discovery() {
        let data = TempDir::new().expect("temp");
        let config = GatewayLaunchConfig::development(data.path()).expect("pinned gateway");
        assert!(
            config.agent_root.ends_with("next\\agent") || config.agent_root.ends_with("next/agent")
        );
        assert!(config.python.is_file());
        assert!(config.hermes_home.starts_with(data.path()));
    }

    #[cfg(target_os = "windows")]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn launches_one_real_gateway_handshakes_and_shuts_it_down() {
        let data = TempDir::new().expect("temp");
        let token = format!("{}{}", "nvapi-", "development-token-123456");
        std::fs::write(data.path().join("nvidia-api.txt"), token).expect("test credential");
        let config = GatewayLaunchConfig::development(data.path()).expect("pinned gateway");
        let manager = HermesProcessManager::new(config);

        manager.start().await.expect("gateway ready");
        let first_pid = manager.diagnostics().await.process_id.expect("gateway pid");
        manager.start().await.expect("idempotent start");
        assert_eq!(manager.diagnostics().await.process_id, Some(first_pid));

        let created = manager
            .request(
                HermesMethod::SessionCreate,
                json!({
                    "cols": 80,
                    "source": "trading_buddy_test",
                    "model": super::COMPANION_MODEL,
                    "provider": super::COMPANION_PROVIDER,
                    "close_on_disconnect": true,
                }),
            )
            .await
            .expect("create session");
        let session_id = created
            .get("session_id")
            .and_then(serde_json::Value::as_str)
            .expect("session id");
        manager
            .request(
                HermesMethod::SessionClose,
                json!({"session_id": session_id}),
            )
            .await
            .expect("close session");

        manager.stop().await.expect("stop gateway");
        let diagnostics = manager.diagnostics().await;
        assert_eq!(diagnostics.status, HermesRuntimeStatus::Stopped);
        assert_eq!(diagnostics.process_id, None);
    }

    #[cfg(target_os = "windows")]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    #[ignore = "requires an NVIDIA API key and network access"]
    async fn streams_one_real_companion_turn_through_nvidia() {
        let data = TempDir::new().expect("temp");
        let config = GatewayLaunchConfig::development(data.path()).expect("pinned gateway");
        let manager = HermesProcessManager::new(config);
        let mut events = manager.subscribe_events();
        let started_at = Instant::now();
        manager.start().await.expect("gateway ready");
        let gateway_ready = started_at.elapsed();
        let session_started_at = Instant::now();
        let created = manager
            .request(
                HermesMethod::SessionCreate,
                json!({
                    "cols": 80,
                    "source": "trading_buddy",
                    "model": super::COMPANION_MODEL,
                    "provider": super::COMPANION_PROVIDER,
                    "close_on_disconnect": true,
                    "trading_buddy_ephemeral": true,
                }),
            )
            .await
            .expect("create ephemeral session");
        let session_created = session_started_at.elapsed();
        let session_id = created
            .get("session_id")
            .and_then(serde_json::Value::as_str)
            .expect("session id")
            .to_owned();
        let prompt_started_at = Instant::now();
        manager
            .request(
                HermesMethod::PromptSubmit,
                json!({
                    "session_id": session_id,
                    "text": "Reply with one short calm sentence confirming the companion test.",
                    "support_mode": "presence",
                    "client_request_id": "real-nvidia-smoke-1",
                    "companion_context": "This is a bounded cloud integration smoke test.",
                }),
            )
            .await
            .expect("submit prompt");
        let accepted = prompt_started_at.elapsed();
        let (visible_text, first_token) = timeout(Duration::from_secs(180), async {
            let mut visible_text = String::new();
            let mut first_token = None;
            loop {
                let event = events.recv().await.expect("gateway event");
                if event.session_id.as_deref() != Some(session_id.as_str()) {
                    continue;
                }
                if event.event_type == "message.delta" {
                    if let Some(text) = event
                        .payload
                        .as_ref()
                        .and_then(|payload| payload.get("text"))
                        .and_then(serde_json::Value::as_str)
                    {
                        first_token.get_or_insert_with(|| prompt_started_at.elapsed());
                        visible_text.push_str(text);
                    }
                }
                if event.event_type == "message.complete" {
                    break (visible_text, first_token);
                }
                if event.event_type == "error" {
                    let message = event
                        .payload
                        .as_ref()
                        .and_then(|payload| payload.get("message"))
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("unknown gateway error");
                    panic!(
                        "gateway reported: {}",
                        crate::hermes_rpc::sanitize_error_message(message)
                    );
                }
            }
        })
        .await
        .expect("real cloud model response timed out");
        assert!(!visible_text.trim().is_empty());
        println!(
            "gateway_ready_ms={} session_create_ms={} accepted_ms={} first_token_ms={} completed_ms={}",
            gateway_ready.as_millis(),
            session_created.as_millis(),
            accepted.as_millis(),
            first_token.expect("first visible token").as_millis(),
            prompt_started_at.elapsed().as_millis(),
        );
        manager
            .request(
                HermesMethod::SessionClose,
                json!({"session_id": session_id}),
            )
            .await
            .expect("close session");
        manager.stop().await.expect("stop gateway");
    }
}
