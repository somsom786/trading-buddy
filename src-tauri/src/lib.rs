mod commands;
mod local_ai;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let local_ai =
        local_ai::LocalAiService::from_environment().expect("valid local Ollama configuration");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(local_ai)
        .setup(|app| {
            window_manager::restore_buddy_position(app.handle());
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
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_app_window,
            control_app_window,
            commands::local_ai::list_local_models,
            commands::local_ai::stream_local_chat,
            commands::local_ai::cancel_local_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Buddy");
}
