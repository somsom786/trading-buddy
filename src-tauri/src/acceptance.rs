use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::{
    agent_events::AgentLatencyDiagnostics,
    agent_session::AgentSessionRuntime,
    desktop_world::{self, SurfaceRect},
    hermes_process::{HermesRuntimeStatus, COMPANION_MODEL},
    storage::{repository, StorageService},
};

const ALLOWED_WINDOW_LABELS: [&str; 3] = ["buddy", "bubble", "main"];

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptanceDiagnostics {
    captured_at_ms: u64,
    application_setup_ms: u64,
    app_process_count: u32,
    gateway_process_count: u32,
    gateway_status: HermesRuntimeStatus,
    gateway_restart_count: u32,
    gateway_spawn_ms: Option<u64>,
    gateway_ready_ms: Option<u64>,
    window_states: Vec<AcceptanceWindowState>,
    monitors: Vec<AcceptanceMonitorState>,
    buddy_rect: SurfaceRect,
    bubble_rect: Option<SurfaceRect>,
    active_local_conversation_id: Option<String>,
    redacted_session_id: Option<String>,
    active_request_id: Option<String>,
    active_turn_id: Option<String>,
    turn_status: String,
    last_sequence_number: u64,
    reconnect_count: u64,
    duplicate_event_count: u64,
    stale_event_count: u64,
    provider_status: String,
    provider_model: &'static str,
    orphan_process_result: &'static str,
    latency: AgentLatencyDiagnostics,
    conversation_count: u32,
    message_count: u32,
    agent_session_link_count: u32,
}

pub struct ApplicationTimingDiagnostics {
    pub setup_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AcceptanceWindowState {
    label: &'static str,
    visible: bool,
    focused: bool,
    bounds: SurfaceRect,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AcceptanceMonitorState {
    id: String,
    bounds: SurfaceRect,
    work_area: SurfaceRect,
    scale_factor: f64,
    primary: bool,
}

#[tauri::command]
pub async fn get_acceptance_diagnostics(
    app: AppHandle,
    runtime: tauri::State<'_, AgentSessionRuntime>,
    application_timing: tauri::State<'_, ApplicationTimingDiagnostics>,
    storage: tauri::State<'_, StorageService>,
) -> Result<AcceptanceDiagnostics, String> {
    if !cfg!(debug_assertions) {
        return Err(
            "Guided acceptance diagnostics are available only in development builds.".into(),
        );
    }

    let world = desktop_world::snapshot(&app, false)?;
    let process = runtime.diagnostics().await;
    let session = runtime.snapshot().await;
    let (conversation_count, message_count, agent_session_link_count) = storage
        .run(|connection, database_path| {
            let file_name = database_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("trading-buddy.db")
                .to_owned();
            let diagnostics = repository::diagnostics(connection, file_name, None)?;
            let links = repository::all_agent_session_links(connection)?;
            Ok((
                diagnostics.conversation_count,
                diagnostics.message_count,
                u32::try_from(links.len()).unwrap_or(u32::MAX),
            ))
        })
        .await
        .map_err(|error| error.to_string())?;
    let window_states = ALLOWED_WINDOW_LABELS
        .iter()
        .filter_map(|label| {
            let window = app.get_webview_window(label)?;
            let position = window.outer_position().ok()?;
            let size = window.outer_size().ok()?;
            Some(AcceptanceWindowState {
                label,
                visible: window.is_visible().unwrap_or(false),
                focused: window.is_focused().unwrap_or(false),
                bounds: SurfaceRect {
                    x: position.x,
                    y: position.y,
                    width: size.width as i32,
                    height: size.height as i32,
                },
            })
        })
        .collect();
    let monitors = world
        .monitors
        .iter()
        .filter_map(|monitor| {
            let work_area = world
                .work_areas
                .iter()
                .find(|work_area| work_area.monitor_id == monitor.id)?;
            Some(AcceptanceMonitorState {
                id: monitor.id.clone(),
                bounds: monitor.bounds,
                work_area: work_area.bounds,
                scale_factor: monitor.scale_factor,
                primary: monitor.primary,
            })
        })
        .collect();

    Ok(AcceptanceDiagnostics {
        captured_at_ms: world.captured_at_ms,
        application_setup_ms: application_timing.setup_ms,
        app_process_count: count_current_executable_processes(),
        gateway_process_count: u32::from(process.process_id.is_some()),
        gateway_status: process.status,
        gateway_restart_count: process.restart_count,
        gateway_spawn_ms: process.gateway_spawn_ms,
        gateway_ready_ms: process.gateway_ready_ms,
        window_states,
        monitors,
        buddy_rect: world.buddy_rect,
        bubble_rect: world.bubble_rect,
        active_local_conversation_id: session.local_conversation_id,
        redacted_session_id: redact_identifier(session.hermes_session_id.as_deref()),
        active_request_id: session.active_request_id,
        active_turn_id: session.active_turn_id,
        turn_status: format!("{:?}", session.turn_status).to_ascii_lowercase(),
        last_sequence_number: session.last_sequence,
        reconnect_count: session.diagnostics.reconnect_count,
        duplicate_event_count: session.diagnostics.duplicate_event_count,
        stale_event_count: session.diagnostics.stale_event_count,
        provider_status: format!("{:?}", session.connection_status).to_ascii_lowercase(),
        provider_model: COMPANION_MODEL,
        orphan_process_result: "not_measurable_while_application_is_running",
        latency: session.diagnostics.latency,
        conversation_count,
        message_count,
        agent_session_link_count,
    })
}

fn redact_identifier(value: Option<&str>) -> Option<String> {
    value.map(|value| {
        let suffix = value
            .chars()
            .rev()
            .take(6)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        format!("...{suffix}")
    })
}

#[cfg(target_os = "windows")]
fn count_current_executable_processes() -> u32 {
    use std::mem::size_of;
    use windows_sys::Win32::{
        Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
        System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
    };

    let Some(file_name) = std::env::current_exe()
        .ok()
        .and_then(|path| path.file_name().map(ToOwned::to_owned))
    else {
        return 1;
    };
    let expected = file_name.to_string_lossy();
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return 1;
    }

    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..unsafe { std::mem::zeroed() }
    };
    let mut count = 0;
    let mut has_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while has_entry {
        let length = entry
            .szExeFile
            .iter()
            .position(|character| *character == 0)
            .unwrap_or(entry.szExeFile.len());
        let candidate = String::from_utf16_lossy(&entry.szExeFile[..length]);
        if candidate.eq_ignore_ascii_case(&expected) {
            count += 1;
        }
        has_entry = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe {
        CloseHandle(snapshot);
    }
    count.max(1)
}

#[cfg(not(target_os = "windows"))]
fn count_current_executable_processes() -> u32 {
    1
}

#[cfg(test)]
mod tests {
    use super::redact_identifier;

    #[test]
    fn redacts_runtime_identifiers_to_a_short_suffix() {
        assert_eq!(
            redact_identifier(Some("session-private-123456")),
            Some("...123456".to_owned())
        );
        assert_eq!(redact_identifier(None), None);
    }
}
