use std::fs;

use tauri::State;

use crate::storage::{
    errors::StorageError,
    models::{
        AppSettings, AssistantMessageFailure, AssistantMessageUpdate, CompanionPreferences,
        ConversationDetail, ConversationRetentionPolicy, ConversationSummary,
        DeleteAllMemoriesResult, DeleteAllResult, DevelopmentFixtureResult, ExportResult, Memory,
        MemoryCategory, MemoryDraft, MemoryExportResult, MemoryListOptions, MemoryPreferences,
        MemorySensitivity, MemoryUsageRecord, MemoryUsageRequest, PrepareGenerationRequest,
        PrepareGenerationResponse, RetentionCleanupResult, RetrievedMemory, StorageDiagnostics,
        StorageStatus,
    },
    repository, StorageService,
};

#[tauri::command]
pub fn get_storage_status(service: State<'_, StorageService>) -> StorageStatus {
    service.status()
}

#[tauri::command]
pub async fn get_storage_diagnostics(
    service: State<'_, StorageService>,
) -> Result<StorageDiagnostics, StorageError> {
    service
        .run(|connection, database_path| {
            let file_name = database_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("trading-buddy.db")
                .to_owned();
            let summary = database_path
                .parent()
                .and_then(|parent| parent.file_name())
                .and_then(|name| name.to_str())
                .map(|directory| format!("{directory}\\{file_name}"));
            repository::diagnostics(connection, file_name, summary)
        })
        .await
}

#[tauri::command]
pub async fn get_app_settings(
    service: State<'_, StorageService>,
) -> Result<AppSettings, StorageError> {
    service
        .run(|connection, _| repository::settings(connection))
        .await
}

#[tauri::command]
pub async fn set_selected_local_model(
    model_name: Option<String>,
    service: State<'_, StorageService>,
) -> Result<AppSettings, StorageError> {
    service
        .run(move |connection, _| repository::set_selected_model(connection, model_name))
        .await
}

#[tauri::command]
pub async fn set_conversation_retention_policy(
    policy: ConversationRetentionPolicy,
    service: State<'_, StorageService>,
) -> Result<RetentionCleanupResult, StorageError> {
    service
        .run(move |connection, _| repository::set_retention_policy(connection, policy))
        .await
}

#[tauri::command]
pub async fn set_companion_preferences(
    preferences: CompanionPreferences,
    service: State<'_, StorageService>,
) -> Result<AppSettings, StorageError> {
    service
        .run(move |connection, _| repository::set_companion_preferences(connection, preferences))
        .await
}

#[tauri::command]
pub async fn set_memory_preferences(
    preferences: MemoryPreferences,
    service: State<'_, StorageService>,
) -> Result<AppSettings, StorageError> {
    service
        .run(move |connection, _| repository::set_memory_preferences(connection, preferences))
        .await
}

#[tauri::command]
pub async fn apply_retention_cleanup(
    service: State<'_, StorageService>,
) -> Result<RetentionCleanupResult, StorageError> {
    service
        .run(|connection, _| repository::cleanup_retention(connection))
        .await
}

#[tauri::command]
pub async fn list_conversations(
    archived: bool,
    limit: u32,
    offset: u32,
    service: State<'_, StorageService>,
) -> Result<Vec<ConversationSummary>, StorageError> {
    service
        .run(move |connection, _| {
            repository::list_conversations(connection, archived, limit, offset)
        })
        .await
}

#[tauri::command]
pub async fn get_conversation(
    conversation_id: String,
    service: State<'_, StorageService>,
) -> Result<ConversationDetail, StorageError> {
    service
        .run(move |connection, _| repository::get_conversation(connection, &conversation_id))
        .await
}

#[tauri::command]
pub async fn set_last_opened_conversation(
    conversation_id: Option<String>,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| {
            repository::set_last_opened_conversation(connection, conversation_id)
        })
        .await
}

#[tauri::command]
pub async fn get_last_opened_conversation(
    service: State<'_, StorageService>,
) -> Result<Option<String>, StorageError> {
    service
        .run(|connection, _| repository::last_opened_conversation(connection))
        .await
}

#[tauri::command]
pub async fn prepare_persistent_generation(
    request: PrepareGenerationRequest,
    service: State<'_, StorageService>,
) -> Result<PrepareGenerationResponse, StorageError> {
    service
        .run(move |connection, _| repository::prepare_generation(connection, request))
        .await
}

#[tauri::command]
pub async fn checkpoint_assistant_message(
    update: AssistantMessageUpdate,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| {
            repository::checkpoint_assistant(connection, update)?;
            Ok(())
        })
        .await
}

#[tauri::command]
pub async fn complete_assistant_message(
    update: AssistantMessageUpdate,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| {
            repository::complete_assistant(connection, update)?;
            Ok(())
        })
        .await
}

#[tauri::command]
pub async fn cancel_assistant_message(
    update: AssistantMessageUpdate,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| {
            repository::cancel_assistant(connection, update)?;
            Ok(())
        })
        .await
}

#[tauri::command]
pub async fn fail_assistant_message(
    update: AssistantMessageFailure,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| {
            repository::fail_assistant(connection, update)?;
            Ok(())
        })
        .await
}

#[tauri::command]
pub async fn rename_conversation(
    conversation_id: String,
    title: String,
    service: State<'_, StorageService>,
) -> Result<ConversationSummary, StorageError> {
    service
        .run(move |connection, _| {
            repository::rename_conversation(connection, &conversation_id, &title)
        })
        .await
}

#[tauri::command]
pub async fn archive_conversation(
    conversation_id: String,
    service: State<'_, StorageService>,
) -> Result<ConversationSummary, StorageError> {
    service
        .run(move |connection, _| repository::archive_conversation(connection, &conversation_id))
        .await
}

#[tauri::command]
pub async fn restore_conversation(
    conversation_id: String,
    service: State<'_, StorageService>,
) -> Result<ConversationSummary, StorageError> {
    service
        .run(move |connection, _| repository::restore_conversation(connection, &conversation_id))
        .await
}

#[tauri::command]
pub async fn delete_conversation(
    conversation_id: String,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| repository::delete_conversation(connection, &conversation_id))
        .await
}

#[tauri::command]
pub async fn delete_all_conversation_data(
    service: State<'_, StorageService>,
) -> Result<DeleteAllResult, StorageError> {
    service
        .run(|connection, _| repository::delete_all_conversations(connection))
        .await
}

#[tauri::command]
pub async fn export_conversations(
    service: State<'_, StorageService>,
) -> Result<Option<ExportResult>, StorageError> {
    let file_path = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("JSON", &["json"])
            .set_file_name("trading-buddy-conversations.json")
            .save_file()
    })
    .await
    .map_err(|error| StorageError::export_failed(error.to_string()))?;

    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let display_path = file_path.display().to_string();
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("trading-buddy-conversations.json")
        .to_owned();
    let exported = service
        .run(move |connection, _| {
            let export = repository::export_file(connection)?;
            let json = serde_json::to_string_pretty(&export)
                .map_err(|error| StorageError::export_failed(error.to_string()))?;
            fs::write(&file_path, json)
                .map_err(|error| StorageError::export_failed(error.to_string()))?;
            Ok(export.conversations.len() as u32)
        })
        .await?;
    Ok(Some(ExportResult {
        exported_conversations: exported,
        file_path: display_path,
        file_name,
    }))
}

#[tauri::command]
pub async fn create_memory(
    draft: MemoryDraft,
    service: State<'_, StorageService>,
) -> Result<Memory, StorageError> {
    service
        .run(move |connection, _| repository::create_memory(connection, draft))
        .await
}

#[tauri::command]
pub async fn list_memories(
    options: MemoryListOptions,
    service: State<'_, StorageService>,
) -> Result<Vec<Memory>, StorageError> {
    service
        .run(move |connection, _| repository::list_memories(connection, options))
        .await
}

#[tauri::command]
pub async fn confirm_memory(
    memory_id: String,
    service: State<'_, StorageService>,
) -> Result<Memory, StorageError> {
    service
        .run(move |connection, _| repository::confirm_memory(connection, &memory_id))
        .await
}

#[tauri::command]
pub async fn reject_memory(
    memory_id: String,
    service: State<'_, StorageService>,
) -> Result<Memory, StorageError> {
    service
        .run(move |connection, _| repository::reject_memory(connection, &memory_id))
        .await
}

#[tauri::command]
pub async fn update_memory_content(
    memory_id: String,
    content: String,
    category: MemoryCategory,
    sensitivity: MemorySensitivity,
    expires_at: Option<String>,
    service: State<'_, StorageService>,
) -> Result<Memory, StorageError> {
    service
        .run(move |connection, _| {
            repository::update_memory_content(
                connection,
                &memory_id,
                content,
                category,
                sensitivity,
                expires_at,
            )
        })
        .await
}

#[tauri::command]
pub async fn delete_memory(
    memory_id: String,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| repository::delete_memory(connection, &memory_id))
        .await
}

#[tauri::command]
pub async fn delete_all_memories(
    service: State<'_, StorageService>,
) -> Result<DeleteAllMemoriesResult, StorageError> {
    service
        .run(|connection, _| repository::delete_all_memories(connection))
        .await
}

#[tauri::command]
pub async fn cleanup_expired_memories(
    service: State<'_, StorageService>,
) -> Result<u32, StorageError> {
    service
        .run(|connection, _| repository::cleanup_expired_memories(connection))
        .await
}

#[tauri::command]
pub async fn retrieve_memories(
    query: String,
    limit: u32,
    include_sensitive: bool,
    service: State<'_, StorageService>,
) -> Result<Vec<RetrievedMemory>, StorageError> {
    service
        .run(move |connection, _| {
            repository::retrieve_memories(connection, &query, limit, include_sensitive)
        })
        .await
}

#[tauri::command]
pub async fn record_memory_usage(
    request: MemoryUsageRequest,
    service: State<'_, StorageService>,
) -> Result<(), StorageError> {
    service
        .run(move |connection, _| repository::record_memory_usage(connection, request))
        .await
}

#[tauri::command]
pub async fn list_memory_usage_records(
    memory_id: Option<String>,
    limit: u32,
    service: State<'_, StorageService>,
) -> Result<Vec<MemoryUsageRecord>, StorageError> {
    service
        .run(move |connection, _| {
            repository::list_memory_usage_records(connection, memory_id, limit)
        })
        .await
}

#[tauri::command]
pub async fn export_memories(
    include_sensitive: bool,
    service: State<'_, StorageService>,
) -> Result<Option<MemoryExportResult>, StorageError> {
    let file_path = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("JSON", &["json"])
            .set_file_name("trading-buddy-memories.json")
            .save_file()
    })
    .await
    .map_err(|error| StorageError::export_failed(error.to_string()))?;

    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let display_path = file_path.display().to_string();
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("trading-buddy-memories.json")
        .to_owned();
    let exported = service
        .run(move |connection, _| {
            let export = repository::export_memory_file(connection, include_sensitive)?;
            let json = serde_json::to_string_pretty(&export)
                .map_err(|error| StorageError::export_failed(error.to_string()))?;
            fs::write(&file_path, json)
                .map_err(|error| StorageError::export_failed(error.to_string()))?;
            Ok(export.memories.len() as u32)
        })
        .await?;
    Ok(Some(MemoryExportResult {
        exported_memories: exported,
        file_path: display_path,
        file_name,
    }))
}

#[tauri::command]
pub async fn create_development_interrupted_fixture(
    service: State<'_, StorageService>,
) -> Result<DevelopmentFixtureResult, StorageError> {
    if !cfg!(debug_assertions) {
        return Err(StorageError::invalid_request(
            "Development storage fixtures are available only in debug builds.",
        ));
    }
    service
        .run(|connection, _| repository::create_development_interrupted_fixture(connection))
        .await
}
