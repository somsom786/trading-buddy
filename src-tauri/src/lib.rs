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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let local_ai =
        local_ai::LocalAiService::from_environment().expect("valid local Ollama configuration");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(local_ai)
        .setup(|app| {
            let storage = storage::StorageService::initialize(app.handle());
            app.manage(storage);
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
            commands::local_ai::cancel_local_chat,
            commands::storage::get_storage_status,
            commands::storage::get_storage_diagnostics,
            commands::storage::get_app_settings,
            commands::storage::set_selected_local_model,
            commands::storage::set_conversation_retention_policy,
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
            commands::storage::create_development_interrupted_fixture
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Buddy");
}
