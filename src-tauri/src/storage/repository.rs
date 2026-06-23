use chrono::{Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::{
    errors::StorageError,
    migrations,
    models::{
        AppSettings, AssistantMessageFailure, AssistantMessageUpdate, ConversationDetail,
        ConversationExport, ConversationExportFile, ConversationRetentionPolicy,
        ConversationSummary, DeleteAllResult, DevelopmentFixtureResult, MessageExport,
        PrepareGenerationRequest, PrepareGenerationResponse, RetentionCleanupResult,
        StorageDiagnostics, StorageMetadata, StoredMessage, StoredMessageRole, StoredMessageStatus,
        MAX_MESSAGE_CONTENT_LENGTH, MAX_MODEL_NAME_LENGTH, MAX_PAGE_LIMIT, MAX_TITLE_LENGTH,
    },
};

pub fn recover_interrupted_streams(connection: &Connection) -> Result<u32, StorageError> {
    let now = timestamp();
    let changed = connection
        .execute(
            "UPDATE messages
             SET status = 'interrupted', updated_at = ?1, completed_at = ?1, request_id = NULL
             WHERE status = 'streaming'",
            params![now],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(changed as u32)
}

pub fn metadata(connection: &Connection) -> Result<StorageMetadata, StorageError> {
    Ok(StorageMetadata {
        schema_version: migrations::schema_version(connection)?,
        application_created_at: metadata_value(connection, "application_created_at")?,
        last_successful_migration_at: metadata_value(connection, "last_successful_migration_at")?,
    })
}

pub fn diagnostics(
    connection: &Connection,
    database_file_name: String,
    database_location_summary: Option<String>,
) -> Result<StorageDiagnostics, StorageError> {
    Ok(StorageDiagnostics {
        available: true,
        database_file_name,
        database_location_summary,
        schema_version: Some(migrations::schema_version(connection)?),
        conversation_count: count_rows(connection, "conversations", None)?,
        active_conversation_count: count_rows(
            connection,
            "conversations",
            Some("archived_at IS NULL"),
        )?,
        archived_conversation_count: count_rows(
            connection,
            "conversations",
            Some("archived_at IS NOT NULL"),
        )?,
        message_count: count_rows(connection, "messages", None)?,
        last_successful_retention_cleanup_at: optional_metadata_value(
            connection,
            "last_successful_retention_cleanup_at",
        )?,
        error: None,
    })
}

pub fn settings(connection: &Connection) -> Result<AppSettings, StorageError> {
    connection
        .query_row(
            "SELECT selected_local_model,
                    ambient_animations_enabled,
                    conversation_retention_policy,
                    last_opened_conversation_id
             FROM app_settings WHERE id = 1",
            [],
            |row| {
                let policy: String = row.get(2)?;
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, i64>(1)?,
                    policy,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .map_err(StorageError::from_sql_read)
        .and_then(
            |(selected_local_model, animations, policy, last_opened_conversation_id)| {
                Ok(AppSettings {
                    selected_local_model,
                    ambient_animations_enabled: animations == 1,
                    conversation_retention_policy: ConversationRetentionPolicy::from_db(&policy)?,
                    last_opened_conversation_id,
                })
            },
        )
}

pub fn set_selected_model(
    connection: &Connection,
    model_name: Option<String>,
) -> Result<AppSettings, StorageError> {
    if let Some(model) = &model_name {
        validate_model_name(model)?;
    }
    connection
        .execute(
            "UPDATE app_settings SET selected_local_model = ?1 WHERE id = 1",
            params![model_name],
        )
        .map_err(StorageError::from_sql_write)?;
    settings(connection)
}

pub fn set_retention_policy(
    connection: &Connection,
    policy: ConversationRetentionPolicy,
) -> Result<RetentionCleanupResult, StorageError> {
    connection
        .execute(
            "UPDATE app_settings SET conversation_retention_policy = ?1 WHERE id = 1",
            params![policy.as_db()],
        )
        .map_err(StorageError::from_sql_write)?;
    cleanup_retention(connection)
}

pub fn set_last_opened_conversation(
    connection: &Connection,
    conversation_id: Option<String>,
) -> Result<(), StorageError> {
    if let Some(id) = &conversation_id {
        validate_identifier(id, "conversation ID")?;
        ensure_conversation_exists(connection, id)?;
    }
    connection
        .execute(
            "UPDATE app_settings SET last_opened_conversation_id = ?1 WHERE id = 1",
            params![conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn last_opened_conversation(connection: &Connection) -> Result<Option<String>, StorageError> {
    Ok(settings(connection)?.last_opened_conversation_id)
}

pub fn prepare_generation(
    connection: &mut Connection,
    request: PrepareGenerationRequest,
) -> Result<PrepareGenerationResponse, StorageError> {
    validate_identifier(&request.request_id, "request ID")?;
    validate_content(&request.user_content)?;
    validate_model_name(&request.model_name)?;

    let now = timestamp();
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let conversation_id = match request.conversation_id {
        Some(id) => {
            validate_identifier(&id, "conversation ID")?;
            ensure_conversation_exists(&transaction, &id)?;
            id
        }
        None => {
            let id = generate_id("conversation");
            let title = derive_conversation_title(&request.user_content);
            transaction
                .execute(
                    "INSERT INTO conversations
                     (id, title, created_at, updated_at, last_message_at)
                     VALUES (?1, ?2, ?3, ?3, ?3)",
                    params![id, title, now],
                )
                .map_err(StorageError::from_sql_write)?;
            id
        }
    };

    let user_message_id = generate_id("message");
    transaction
        .execute(
            "INSERT INTO messages
             (id, conversation_id, role, content, status, created_at, updated_at, completed_at)
             VALUES (?1, ?2, 'user', ?3, 'completed', ?4, ?4, ?4)",
            params![user_message_id, conversation_id, request.user_content, now],
        )
        .map_err(StorageError::from_sql_write)?;

    let assistant_message_id = generate_id("message");
    transaction
        .execute(
            "INSERT INTO messages
             (id, conversation_id, role, content, status, model_name, request_id, created_at, updated_at)
             VALUES (?1, ?2, 'assistant', '', 'streaming', ?3, ?4, ?5, ?5)",
            params![
                assistant_message_id,
                conversation_id,
                request.model_name,
                request.request_id,
                now
            ],
        )
        .map_err(StorageError::from_sql_write)?;

    transaction
        .execute(
            "UPDATE conversations
             SET updated_at = ?1, last_message_at = ?1
             WHERE id = ?2",
            params![now, conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction
        .execute(
            "UPDATE app_settings SET last_opened_conversation_id = ?1 WHERE id = 1",
            params![conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;

    Ok(PrepareGenerationResponse {
        conversation: conversation_summary(connection, &conversation_id)?,
        user_message: message(connection, &user_message_id)?,
        assistant_message: message(connection, &assistant_message_id)?,
    })
}

pub fn checkpoint_assistant(
    connection: &mut Connection,
    update: AssistantMessageUpdate,
) -> Result<StoredMessage, StorageError> {
    update_assistant_status(connection, update, StoredMessageStatus::Streaming, None)
}

pub fn complete_assistant(
    connection: &mut Connection,
    update: AssistantMessageUpdate,
) -> Result<StoredMessage, StorageError> {
    update_assistant_status(connection, update, StoredMessageStatus::Completed, None)
}

pub fn cancel_assistant(
    connection: &mut Connection,
    update: AssistantMessageUpdate,
) -> Result<StoredMessage, StorageError> {
    update_assistant_status(connection, update, StoredMessageStatus::Cancelled, None)
}

pub fn fail_assistant(
    connection: &mut Connection,
    update: AssistantMessageFailure,
) -> Result<StoredMessage, StorageError> {
    validate_error_code(&update.error_code)?;
    update_assistant_status(
        connection,
        AssistantMessageUpdate {
            message_id: update.message_id,
            request_id: update.request_id,
            content: update.content,
        },
        StoredMessageStatus::Failed,
        Some(update.error_code),
    )
}

pub fn list_conversations(
    connection: &Connection,
    archived: bool,
    limit: u32,
    offset: u32,
) -> Result<Vec<ConversationSummary>, StorageError> {
    let limit = limit.clamp(1, MAX_PAGE_LIMIT);
    let archived_clause = if archived {
        "archived_at IS NOT NULL"
    } else {
        "archived_at IS NULL"
    };
    let sql = format!(
        "SELECT c.id, c.title, c.created_at, c.updated_at, c.archived_at, c.last_message_at,
                (
                  SELECT m.content FROM messages m
                  WHERE m.conversation_id = c.id AND length(m.content) > 0
                  ORDER BY m.created_at DESC, m.id DESC
                  LIMIT 1
                ) AS preview,
                (
                  SELECT COUNT(*) FROM messages m
                  WHERE m.conversation_id = c.id
                ) AS message_count
         FROM conversations c
         WHERE {archived_clause}
         ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC, c.id DESC
         LIMIT ?1 OFFSET ?2"
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![limit, offset], map_conversation_summary)
        .map_err(StorageError::from_sql_read)?;
    collect_rows(rows)
}

pub fn get_conversation(
    connection: &Connection,
    conversation_id: &str,
) -> Result<ConversationDetail, StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    Ok(ConversationDetail {
        conversation: conversation_summary(connection, conversation_id)?,
        messages: messages_for_conversation(connection, conversation_id)?,
    })
}

pub fn rename_conversation(
    connection: &Connection,
    conversation_id: &str,
    title: &str,
) -> Result<ConversationSummary, StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    let title = normalize_title(title);
    if title.is_empty() {
        return Err(StorageError::invalid_request(
            "Conversation title cannot be empty.",
        ));
    }
    let now = timestamp();
    let changed = connection
        .execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::conversation_not_found());
    }
    conversation_summary(connection, conversation_id)
}

pub fn archive_conversation(
    connection: &Connection,
    conversation_id: &str,
) -> Result<ConversationSummary, StorageError> {
    set_archive_state(connection, conversation_id, true)
}

pub fn restore_conversation(
    connection: &Connection,
    conversation_id: &str,
) -> Result<ConversationSummary, StorageError> {
    set_archive_state(connection, conversation_id, false)
}

pub fn delete_conversation(
    connection: &Connection,
    conversation_id: &str,
) -> Result<(), StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    let changed = connection
        .execute(
            "DELETE FROM conversations WHERE id = ?1",
            params![conversation_id],
        )
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?;
    if changed == 0 {
        return Err(StorageError::conversation_not_found());
    }
    connection
        .execute(
            "UPDATE app_settings
             SET last_opened_conversation_id = NULL
             WHERE last_opened_conversation_id = ?1",
            params![conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn delete_all_conversations(
    connection: &mut Connection,
) -> Result<DeleteAllResult, StorageError> {
    let transaction = connection
        .transaction()
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?;
    let deleted: u32 = transaction
        .query_row("SELECT COUNT(*) FROM conversations", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?
        .try_into()
        .map_err(|_| StorageError::invalid_stored_data("Conversation count overflow."))?;
    transaction
        .execute("DELETE FROM conversations", [])
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?;
    transaction
        .execute(
            "UPDATE app_settings SET last_opened_conversation_id = NULL WHERE id = 1",
            [],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction
        .commit()
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")
        .map_err(|error| StorageError::deletion_failed(error.to_string()))?;
    Ok(DeleteAllResult {
        deleted_conversations: deleted,
    })
}

pub fn cleanup_retention(connection: &Connection) -> Result<RetentionCleanupResult, StorageError> {
    let policy = settings(connection)?.conversation_retention_policy;
    let Some(days) = policy.max_age_days() else {
        record_retention_cleanup(connection)?;
        return Ok(RetentionCleanupResult {
            removed_conversations: 0,
        });
    };
    let cutoff = (Utc::now() - Duration::days(days)).to_rfc3339();
    let removed = connection
        .execute(
            "DELETE FROM conversations
             WHERE COALESCE(last_message_at, updated_at) < ?1",
            params![cutoff],
        )
        .map_err(|error| StorageError::retention_failed(error.to_string()))?;
    record_retention_cleanup(connection)?;
    Ok(RetentionCleanupResult {
        removed_conversations: removed as u32,
    })
}

pub fn export_file(connection: &Connection) -> Result<ConversationExportFile, StorageError> {
    let conversations = list_conversations_for_export(connection)?;
    Ok(ConversationExportFile {
        format: "trading-buddy-conversations".to_owned(),
        version: 1,
        exported_at: timestamp(),
        conversations,
    })
}

pub fn create_development_interrupted_fixture(
    connection: &mut Connection,
) -> Result<DevelopmentFixtureResult, StorageError> {
    let prepared = prepare_generation(
        connection,
        PrepareGenerationRequest {
            conversation_id: None,
            request_id: generate_id("request"),
            user_content: "Development fixture: interrupted generation recovery.".to_owned(),
            model_name: "qwen3:8b".to_owned(),
        },
    )?;
    checkpoint_assistant(
        connection,
        AssistantMessageUpdate {
            message_id: prepared.assistant_message.id.clone(),
            request_id: prepared
                .assistant_message
                .request_id
                .clone()
                .ok_or_else(|| {
                    StorageError::invalid_stored_data(
                        "Fixture assistant message has no request ID.",
                    )
                })?,
            content: "Visible checkpoint from a development interrupted-generation fixture."
                .to_owned(),
        },
    )?;
    Ok(DevelopmentFixtureResult {
        conversation_id: prepared.conversation.id,
        assistant_message_id: prepared.assistant_message.id,
    })
}

fn update_assistant_status(
    connection: &mut Connection,
    update: AssistantMessageUpdate,
    status: StoredMessageStatus,
    error_code: Option<String>,
) -> Result<StoredMessage, StorageError> {
    validate_identifier(&update.message_id, "message ID")?;
    validate_identifier(&update.request_id, "request ID")?;
    validate_content_allow_empty(&update.content)?;
    let now = timestamp();
    let completed_at = if status == StoredMessageStatus::Streaming {
        None
    } else {
        Some(now.clone())
    };
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let conversation_id: Option<String> = transaction
        .query_row(
            "SELECT conversation_id FROM messages
             WHERE id = ?1 AND request_id = ?2 AND role = 'assistant' AND status = 'streaming'",
            params![update.message_id, update.request_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    let conversation_id = conversation_id.ok_or_else(StorageError::message_not_found)?;
    transaction
        .execute(
            "UPDATE messages
             SET content = ?1, status = ?2, updated_at = ?3, completed_at = ?4,
                 request_id = CASE WHEN ?2 = 'streaming' THEN request_id ELSE NULL END,
                 error_code = ?5
             WHERE id = ?6",
            params![
                update.content,
                status.as_db(),
                now,
                completed_at,
                error_code,
                update.message_id
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction
        .execute(
            "UPDATE conversations
             SET updated_at = ?1, last_message_at = ?1
             WHERE id = ?2",
            params![now, conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    message(connection, &update.message_id)
}

fn set_archive_state(
    connection: &Connection,
    conversation_id: &str,
    archived: bool,
) -> Result<ConversationSummary, StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    let now = timestamp();
    let archived_at = if archived { Some(now.clone()) } else { None };
    let changed = connection
        .execute(
            "UPDATE conversations
             SET archived_at = ?1, updated_at = ?2
             WHERE id = ?3",
            params![archived_at, now, conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::conversation_not_found());
    }
    conversation_summary(connection, conversation_id)
}

fn conversation_summary(
    connection: &Connection,
    conversation_id: &str,
) -> Result<ConversationSummary, StorageError> {
    connection
        .query_row(
            "SELECT c.id, c.title, c.created_at, c.updated_at, c.archived_at, c.last_message_at,
                    (
                      SELECT m.content FROM messages m
                      WHERE m.conversation_id = c.id AND length(m.content) > 0
                      ORDER BY m.created_at DESC, m.id DESC
                      LIMIT 1
                    ) AS preview,
                    (
                      SELECT COUNT(*) FROM messages m
                      WHERE m.conversation_id = c.id
                    ) AS message_count
             FROM conversations c
             WHERE c.id = ?1",
            params![conversation_id],
            map_conversation_summary,
        )
        .optional()
        .map_err(StorageError::from_sql_read)?
        .ok_or_else(StorageError::conversation_not_found)
}

fn ensure_conversation_exists(
    connection: &Connection,
    conversation_id: &str,
) -> Result<(), StorageError> {
    let exists: Option<i64> = connection
        .query_row(
            "SELECT 1 FROM conversations WHERE id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    exists
        .map(|_| ())
        .ok_or_else(StorageError::conversation_not_found)
}

fn message(connection: &Connection, message_id: &str) -> Result<StoredMessage, StorageError> {
    connection
        .query_row(
            "SELECT id, conversation_id, role, content, status, model_name, request_id,
                    created_at, updated_at, completed_at, error_code
             FROM messages WHERE id = ?1",
            params![message_id],
            map_message,
        )
        .optional()
        .map_err(StorageError::from_sql_read)?
        .ok_or_else(StorageError::message_not_found)
}

fn messages_for_conversation(
    connection: &Connection,
    conversation_id: &str,
) -> Result<Vec<StoredMessage>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, conversation_id, role, content, status, model_name, request_id,
                    created_at, updated_at, completed_at, error_code
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY created_at ASC, id ASC",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![conversation_id], map_message)
        .map_err(StorageError::from_sql_read)?;
    collect_rows(rows)
}

fn list_conversations_for_export(
    connection: &Connection,
) -> Result<Vec<ConversationExport>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, created_at, updated_at, archived_at
             FROM conversations
             ORDER BY COALESCE(last_message_at, updated_at) DESC, id DESC",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;

    let mut conversations = Vec::new();
    for row in rows {
        let (id, title, created_at, updated_at, archived_at) =
            row.map_err(StorageError::from_sql_read)?;
        conversations.push(ConversationExport {
            messages: message_exports(connection, &id)?,
            id,
            title,
            created_at,
            updated_at,
            archived_at,
        });
    }
    Ok(conversations)
}

fn message_exports(
    connection: &Connection,
    conversation_id: &str,
) -> Result<Vec<MessageExport>, StorageError> {
    let messages = messages_for_conversation(connection, conversation_id)?;
    Ok(messages
        .into_iter()
        .map(|message| MessageExport {
            id: message.id,
            role: message.role,
            status: message.status,
            content: message.content,
            model_name: message.model_name,
            created_at: message.created_at,
            updated_at: message.updated_at,
            completed_at: message.completed_at,
        })
        .collect())
}

fn map_conversation_summary(row: &rusqlite::Row<'_>) -> rusqlite::Result<ConversationSummary> {
    let preview: Option<String> = row.get(6)?;
    let message_count: i64 = row.get(7)?;
    Ok(ConversationSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
        archived_at: row.get(4)?,
        last_message_at: row.get(5)?,
        last_message_preview: preview.map(|value| preview_text(&value)),
        message_count: message_count.max(0) as u32,
    })
}

fn map_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredMessage> {
    let role: String = row.get(2)?;
    let status: String = row.get(4)?;
    Ok(StoredMessage {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        role: StoredMessageRole::from_db(&role).map_err(to_sql_conversion_error)?,
        content: row.get(3)?,
        status: StoredMessageStatus::from_db(&status).map_err(to_sql_conversion_error)?,
        model_name: row.get(5)?,
        request_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        completed_at: row.get(9)?,
        error_code: row.get(10)?,
    })
}

fn collect_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Vec<T>, StorageError> {
    rows.map(|row| row.map_err(StorageError::from_sql_read))
        .collect()
}

fn to_sql_conversion_error(error: StorageError) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
}

fn metadata_value(connection: &Connection, key: &str) -> Result<String, StorageError> {
    connection
        .query_row(
            "SELECT value FROM storage_metadata WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .map_err(StorageError::from_sql_read)
}

fn optional_metadata_value(
    connection: &Connection,
    key: &str,
) -> Result<Option<String>, StorageError> {
    connection
        .query_row(
            "SELECT value FROM storage_metadata WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)
}

fn record_retention_cleanup(connection: &Connection) -> Result<(), StorageError> {
    connection
        .execute(
            "INSERT INTO storage_metadata (key, value)
             VALUES ('last_successful_retention_cleanup_at', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![timestamp()],
        )
        .map_err(|error| StorageError::retention_failed(error.to_string()))?;
    Ok(())
}

fn count_rows(
    connection: &Connection,
    table: &str,
    where_clause: Option<&str>,
) -> Result<u32, StorageError> {
    let sql = match where_clause {
        Some(clause) => format!("SELECT COUNT(*) FROM {table} WHERE {clause}"),
        None => format!("SELECT COUNT(*) FROM {table}"),
    };
    let count: i64 = connection
        .query_row(&sql, [], |row| row.get(0))
        .map_err(StorageError::from_sql_read)?;
    count
        .try_into()
        .map_err(|_| StorageError::invalid_stored_data("Row count overflow."))
}

pub fn derive_conversation_title(content: &str) -> String {
    let normalized = normalize_title(content);
    if normalized.is_empty() {
        "New conversation".to_owned()
    } else {
        normalized
    }
}

fn normalize_title(content: &str) -> String {
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_chars(&normalized, MAX_TITLE_LENGTH)
}

fn preview_text(content: &str) -> String {
    truncate_chars(
        &content.split_whitespace().collect::<Vec<_>>().join(" "),
        120,
    )
}

fn truncate_chars(content: &str, max_chars: usize) -> String {
    let mut output = String::new();
    for character in content.chars().take(max_chars) {
        output.push(character);
    }
    output
}

fn validate_identifier(value: &str, label: &str) -> Result<(), StorageError> {
    let valid = !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_:.".contains(character));
    if valid {
        Ok(())
    } else {
        Err(StorageError::invalid_request(format!(
            "Invalid {label} supplied."
        )))
    }
}

fn validate_content(content: &str) -> Result<(), StorageError> {
    if content.trim().is_empty() {
        return Err(StorageError::invalid_request(
            "Message content cannot be empty.",
        ));
    }
    validate_content_allow_empty(content)
}

fn validate_content_allow_empty(content: &str) -> Result<(), StorageError> {
    if content.len() > MAX_MESSAGE_CONTENT_LENGTH {
        return Err(StorageError::invalid_request(
            "Message content exceeds the local storage limit.",
        ));
    }
    Ok(())
}

fn validate_model_name(model: &str) -> Result<(), StorageError> {
    let valid = !model.is_empty()
        && model.len() <= MAX_MODEL_NAME_LENGTH
        && !model.contains("://")
        && !model.starts_with(['.', '/'])
        && model
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._-:/".contains(character));
    if valid {
        Ok(())
    } else {
        Err(StorageError::invalid_request(
            "The selected model name contains unsupported characters.",
        ))
    }
}

fn validate_error_code(error_code: &str) -> Result<(), StorageError> {
    if error_code.is_empty()
        || error_code.len() > 80
        || !error_code
            .chars()
            .all(|character| character.is_ascii_lowercase() || character == '_')
    {
        return Err(StorageError::invalid_request(
            "The message error code was invalid.",
        ));
    }
    Ok(())
}

fn generate_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

fn timestamp() -> String {
    Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::storage::migrations::{configure_connection, run_migrations};

    fn database() -> Connection {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        connection
    }

    fn generation(content: &str) -> PrepareGenerationRequest {
        PrepareGenerationRequest {
            conversation_id: None,
            request_id: "request-1".to_owned(),
            user_content: content.to_owned(),
            model_name: "qwen3:4b".to_owned(),
        }
    }

    #[test]
    fn derives_deterministic_titles() {
        assert_eq!(derive_conversation_title("hello buddy"), "hello buddy");
        assert_eq!(
            derive_conversation_title("hello\n\nlittle\tbuddy"),
            "hello little buddy"
        );
        assert_eq!(derive_conversation_title("   "), "New conversation");
        assert_eq!(derive_conversation_title("price 🚀 now"), "price 🚀 now");
        assert_eq!(
            derive_conversation_title("漢字 and emoji 🧠"),
            "漢字 and emoji 🧠"
        );
        assert_eq!(
            derive_conversation_title(&"a".repeat(200)).chars().count(),
            80
        );
    }

    #[test]
    fn creates_conversation_and_messages() {
        let mut connection = database();
        let prepared = prepare_generation(&mut connection, generation("Should I wait?"))
            .expect("prepare generation");
        assert_eq!(prepared.conversation.title, "Should I wait?");
        assert_eq!(prepared.user_message.status, StoredMessageStatus::Completed);
        assert_eq!(
            prepared.assistant_message.status,
            StoredMessageStatus::Streaming
        );
        assert_eq!(
            list_conversations(&connection, false, 20, 0)
                .expect("list")
                .len(),
            1
        );
    }

    #[test]
    fn completes_cancelled_failed_and_interrupted_lifecycles() {
        let mut connection = database();
        let prepared = prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        let update = AssistantMessageUpdate {
            message_id: prepared.assistant_message.id.clone(),
            request_id: "request-1".to_owned(),
            content: "Partial answer".to_owned(),
        };
        checkpoint_assistant(&mut connection, update.clone()).expect("checkpoint");
        let completed = complete_assistant(&mut connection, update).expect("complete");
        assert_eq!(completed.status, StoredMessageStatus::Completed);

        let prepared = prepare_generation(
            &mut connection,
            PrepareGenerationRequest {
                conversation_id: Some(prepared.conversation.id),
                request_id: "request-2".to_owned(),
                user_content: "Again".to_owned(),
                model_name: "qwen3:4b".to_owned(),
            },
        )
        .expect("prepare second");
        let cancelled = cancel_assistant(
            &mut connection,
            AssistantMessageUpdate {
                message_id: prepared.assistant_message.id.clone(),
                request_id: "request-2".to_owned(),
                content: "Saved partial".to_owned(),
            },
        )
        .expect("cancel");
        assert_eq!(cancelled.status, StoredMessageStatus::Cancelled);

        let prepared = prepare_generation(
            &mut connection,
            PrepareGenerationRequest {
                conversation_id: Some(prepared.conversation.id),
                request_id: "request-3".to_owned(),
                user_content: "Again again".to_owned(),
                model_name: "qwen3:4b".to_owned(),
            },
        )
        .expect("prepare third");
        let failed = fail_assistant(
            &mut connection,
            AssistantMessageFailure {
                message_id: prepared.assistant_message.id,
                request_id: "request-3".to_owned(),
                content: "Failed partial".to_owned(),
                error_code: "generation_failed".to_owned(),
            },
        )
        .expect("fail");
        assert_eq!(failed.status, StoredMessageStatus::Failed);

        let interrupted = recover_interrupted_streams(&connection).expect("recover");
        assert_eq!(interrupted, 0);
    }

    #[test]
    fn rejects_stale_request_updates() {
        let mut connection = database();
        let prepared = prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        let result = checkpoint_assistant(
            &mut connection,
            AssistantMessageUpdate {
                message_id: prepared.assistant_message.id,
                request_id: "wrong-request".to_owned(),
                content: "Nope".to_owned(),
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn archives_restores_and_deletes_with_cascade() {
        let mut connection = database();
        let prepared = prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        archive_conversation(&connection, &prepared.conversation.id).expect("archive");
        assert_eq!(
            list_conversations(&connection, true, 20, 0)
                .expect("archived")
                .len(),
            1
        );
        restore_conversation(&connection, &prepared.conversation.id).expect("restore");
        delete_conversation(&connection, &prepared.conversation.id).expect("delete");
        let message_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))
            .expect("message count");
        assert_eq!(message_count, 0);
    }

    #[test]
    fn persists_settings_and_last_opened() {
        let mut connection = database();
        let prepared = prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        set_selected_model(&connection, Some("qwen3:4b".to_owned())).expect("model");
        set_last_opened_conversation(&connection, Some(prepared.conversation.id.clone()))
            .expect("last opened");
        let settings = settings(&connection).expect("settings");
        assert_eq!(settings.selected_local_model.as_deref(), Some("qwen3:4b"));
        assert_eq!(
            settings.last_opened_conversation_id.as_deref(),
            Some(prepared.conversation.id.as_str())
        );
    }

    #[test]
    fn keep_until_delete_retention_removes_nothing() {
        let mut connection = database();
        prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        let cleanup = cleanup_retention(&connection).expect("cleanup");
        assert_eq!(cleanup.removed_conversations, 0);
        let diagnostics = diagnostics(
            &connection,
            "trading-buddy.db".to_owned(),
            Some("com.tradingbuddy.desktop\\trading-buddy.db".to_owned()),
        )
        .expect("diagnostics");
        assert_eq!(diagnostics.conversation_count, 1);
        assert_eq!(diagnostics.active_conversation_count, 1);
        assert_eq!(diagnostics.archived_conversation_count, 0);
        assert_eq!(diagnostics.message_count, 2);
        assert!(diagnostics.last_successful_retention_cleanup_at.is_some());
    }

    #[test]
    fn retention_deletes_only_older_conversations() {
        let mut connection = database();
        let old = prepare_generation(&mut connection, generation("Old")).expect("old");
        connection
            .execute(
                "UPDATE conversations SET last_message_at = '2020-01-01T00:00:00Z', updated_at = '2020-01-01T00:00:00Z'
                 WHERE id = ?1",
                params![old.conversation.id],
            )
            .expect("age old");
        prepare_generation(
            &mut connection,
            PrepareGenerationRequest {
                conversation_id: None,
                request_id: "request-2".to_owned(),
                user_content: "New".to_owned(),
                model_name: "qwen3:4b".to_owned(),
            },
        )
        .expect("new");
        set_retention_policy(&connection, ConversationRetentionPolicy::DeleteAfter30Days)
            .expect("policy");
        assert_eq!(
            list_conversations(&connection, false, 20, 0)
                .expect("list")
                .len(),
            1
        );
    }

    #[test]
    fn diagnostics_counts_active_archived_and_messages() {
        let mut connection = database();
        let active = prepare_generation(&mut connection, generation("Active")).expect("active");
        let archived = prepare_generation(
            &mut connection,
            PrepareGenerationRequest {
                conversation_id: None,
                request_id: "request-2".to_owned(),
                user_content: "Archived".to_owned(),
                model_name: "qwen3:4b".to_owned(),
            },
        )
        .expect("archived");
        archive_conversation(&connection, &archived.conversation.id).expect("archive");

        let result =
            diagnostics(&connection, "trading-buddy.db".to_owned(), None).expect("diagnostics");
        assert!(result.available);
        assert_eq!(result.database_file_name, "trading-buddy.db");
        assert_eq!(result.conversation_count, 2);
        assert_eq!(result.active_conversation_count, 1);
        assert_eq!(result.archived_conversation_count, 1);
        assert_eq!(result.message_count, 4);
        assert_eq!(active.conversation.title, "Active");
    }

    #[test]
    fn development_interrupted_fixture_recovers_on_startup() {
        let mut connection = database();
        let fixture = create_development_interrupted_fixture(&mut connection).expect("fixture");
        let before = message(&connection, &fixture.assistant_message_id).expect("before");
        assert_eq!(before.status, StoredMessageStatus::Streaming);
        assert_eq!(
            before.content,
            "Visible checkpoint from a development interrupted-generation fixture."
        );
        assert!(before.request_id.is_some());

        let changed = recover_interrupted_streams(&connection).expect("recover");
        assert_eq!(changed, 1);
        let after = message(&connection, &fixture.assistant_message_id).expect("after");
        assert_eq!(after.status, StoredMessageStatus::Interrupted);
        assert_eq!(after.content, before.content);
        assert!(after.request_id.is_none());
    }

    #[test]
    fn export_excludes_internal_request_fields() {
        let mut connection = database();
        let prepared =
            prepare_generation(&mut connection, generation("Hello 🧠")).expect("prepare");
        complete_assistant(
            &mut connection,
            AssistantMessageUpdate {
                message_id: prepared.assistant_message.id,
                request_id: "request-1".to_owned(),
                content: "Visible answer".to_owned(),
            },
        )
        .expect("complete");
        let export = export_file(&connection).expect("export");
        let json = serde_json::to_string(&export).expect("json");
        assert!(json.contains("trading-buddy-conversations"));
        assert!(json.contains("Hello 🧠"));
        assert!(!json.contains("request-1"));
        assert!(!json.contains("system"));
        assert!(!json.contains("thinking"));
    }

    #[test]
    fn delete_all_clears_conversations_and_settings_pointer() {
        let mut connection = database();
        prepare_generation(&mut connection, generation("Hello")).expect("prepare");
        let result = delete_all_conversations(&mut connection).expect("delete all");
        assert_eq!(result.deleted_conversations, 1);
        assert!(last_opened_conversation(&connection)
            .expect("last opened")
            .is_none());
    }
}
