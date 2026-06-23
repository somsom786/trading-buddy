use tauri::{ipc::Channel, State};

use crate::local_ai::{
    errors::LocalAiError,
    models::{LocalChatEvent, LocalChatRequest, LocalModel},
    LocalAiService,
};

#[tauri::command]
pub async fn list_local_models(
    service: State<'_, LocalAiService>,
) -> Result<Vec<LocalModel>, LocalAiError> {
    service.list_models().await
}

#[tauri::command]
pub async fn stream_local_chat(
    request: LocalChatRequest,
    on_event: Channel<LocalChatEvent>,
    service: State<'_, LocalAiService>,
) -> Result<(), LocalAiError> {
    service.stream_chat(request, on_event).await
}

#[tauri::command]
pub fn cancel_local_chat(
    request_id: String,
    service: State<'_, LocalAiService>,
) -> Result<(), LocalAiError> {
    service.cancel(&request_id)
}
