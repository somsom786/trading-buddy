mod commands;
mod local_ai;
mod storage;
mod window_manager;

use tauri::Manager;

#[tauri::command]
fn open_app_window(app: tauri::AppHandle, label: &str) -> Result<(), String> {
    window_manager::open_window(&app, label)
}

#[tauri::command]
fn control_app_window(app: tauri::AppHandle, label: &str, action: &str) -> Result<(), String> {
    window_manager::control_window(&app, label, action)
}

#[tauri::command]
fn toggle_companion_bubble(app: tauri::AppHandle) -> Result<(), String> {
    window_manager::toggle_bubble(&app)
}

#[tauri::command]
fn position_companion_bubble(app: tauri::AppHandle) -> Result<(), String> {
    window_manager::position_bubble(&app)
}

#[tauri::command]
fn reset_buddy_position(app: tauri::AppHandle) -> Result<(), String> {
    window_manager::reset_buddy_position(&app)
}

#[tauri::command]
fn get_os_idle_seconds() -> Result<u64, String> {
    platform_idle_seconds()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let local_ai =
        local_ai::LocalAiService::from_environment().expect("valid local Ollama configuration");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(local_ai)
        .setup(|app| {
            let storage = storage::StorageService::initialize(app.handle());
            let companion_preferences = storage
                .settings_snapshot()
                .ok()
                .map(|settings| settings.companion_preferences);
            app.manage(storage);
            window_manager::restore_buddy_position(app.handle());
            if let Some(preferences) = companion_preferences {
                window_manager::apply_startup_preferences(app.handle(), &preferences);
            }
            window_manager::create_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            if window.label() == "buddy" {
                if let tauri::WindowEvent::Moved(position) = event {
                    window_manager::persist_buddy_position(window.app_handle(), *position);
                    let _ = window_manager::position_bubble(window.app_handle());
                }
            }
            if window.label() == "bubble" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_app_window,
            control_app_window,
            toggle_companion_bubble,
            position_companion_bubble,
            reset_buddy_position,
            get_os_idle_seconds,
            commands::local_ai::list_local_models,
            commands::local_ai::stream_local_chat,
            commands::local_ai::cancel_local_chat,
            commands::storage::get_storage_status,
            commands::storage::get_storage_diagnostics,
            commands::storage::get_app_settings,
            commands::storage::set_selected_local_model,
            commands::storage::set_conversation_retention_policy,
            commands::storage::set_companion_preferences,
            commands::storage::set_memory_preferences,
            commands::storage::apply_retention_cleanup,
            commands::storage::list_conversations,
            commands::storage::get_conversation,
            commands::storage::set_last_opened_conversation,
            commands::storage::get_last_opened_conversation,
            commands::storage::prepare_persistent_generation,
            commands::storage::checkpoint_assistant_message,
            commands::storage::complete_assistant_message,
            commands::storage::cancel_assistant_message,
            commands::storage::fail_assistant_message,
            commands::storage::rename_conversation,
            commands::storage::archive_conversation,
            commands::storage::restore_conversation,
            commands::storage::delete_conversation,
            commands::storage::delete_all_conversation_data,
            commands::storage::export_conversations,
            commands::storage::create_memory,
            commands::storage::list_memories,
            commands::storage::confirm_memory,
            commands::storage::reject_memory,
            commands::storage::update_memory_content,
            commands::storage::delete_memory,
            commands::storage::delete_all_memories,
            commands::storage::cleanup_expired_memories,
            commands::storage::retrieve_memories,
            commands::storage::record_memory_usage,
            commands::storage::list_memory_usage_records,
            commands::storage::export_memories,
            commands::storage::create_development_interrupted_fixture
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Buddy");
}

#[cfg(target_os = "windows")]
fn platform_idle_seconds() -> Result<u64, String> {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return Err("Could not read OS idle duration.".to_owned());
    }
    let now = unsafe { GetTickCount() };
    Ok(now.saturating_sub(info.dwTime) as u64 / 1_000)
}

#[cfg(not(target_os = "windows"))]
fn platform_idle_seconds() -> Result<u64, String> {
    Ok(0)
}
