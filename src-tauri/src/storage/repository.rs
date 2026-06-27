use chrono::{Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::{
    errors::StorageError,
    migrations,
    models::{
        AppSettings, AssistantMessageFailure, AssistantMessageUpdate, CompanionFreePosition,
        CompanionPlacementMode, CompanionPreferences, ContinuityPreferences, ConversationDetail,
        ConversationExport, ConversationExportFile, ConversationRetentionPolicy,
        ConversationSummary, DeleteAllJournalResult, DeleteAllMemoriesResult, DeleteAllResult,
        DevelopmentFixtureResult, DevelopmentJournalFixtureResult, DevelopmentMemoryFixtureResult,
        JournalDiagnostics, JournalEntry, JournalEntryDraft, JournalEntrySummary,
        JournalEntryUpdate, JournalExportFile, JournalKind, JournalListOptions, JournalMode,
        JournalPreferences, JournalSort, JournalSourceKind, JournalStatus, Memory,
        MemoryApprovalMode, MemoryCategory, MemoryDiagnostics, MemoryDraft, MemoryExportFile,
        MemoryListOptions, MemoryPreferences, MemorySensitivity, MemorySourceKind, MemoryStatus,
        MemoryUsageRecord, MemoryUsageRequest, MessageExport, MovementIntensity,
        PrepareGenerationRequest, PrepareGenerationResponse, RetentionCleanupResult,
        RetrievedMemory, StorageDiagnostics, StorageMetadata, StoredMessage, StoredMessageRole,
        StoredMessageStatus, MAX_JOURNAL_BODY_LENGTH, MAX_JOURNAL_SEARCH_LENGTH,
        MAX_JOURNAL_SUMMARY_LENGTH, MAX_JOURNAL_TAGS, MAX_JOURNAL_TAG_LENGTH,
        MAX_JOURNAL_TITLE_LENGTH, MAX_MEMORY_CONTENT_LENGTH, MAX_MEMORY_SEARCH_LENGTH,
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
                    last_opened_conversation_id,
                    buddy_visible,
                    buddy_always_on_top,
                    buddy_placement_mode,
                    buddy_free_position_x,
                    buddy_free_position_y,
                    reduced_movement_enabled,
                    sleep_after_inactivity_seconds,
                    proactive_checkins_enabled,
                    proactive_checkin_cooldown_minutes,
                    quiet_hours_enabled,
                    quiet_hours_start,
                    quiet_hours_end,
                    do_not_disturb,
                    global_shortcut_enabled,
                    launch_at_login,
                    open_companion_home_at_startup,
                    bubble_width,
                    memory_enabled,
                    memory_approval_mode,
                    allow_personal_memories,
                    allow_sensitive_memories,
                    show_memory_used_indicator,
                    memory_candidate_notifications,
                    temporary_memory_default_expiry_days,
                    use_memories_in_temporary_chat,
                    journaling_enabled,
                    default_journal_mode,
                    default_entry_private,
                    allow_memory_candidates_from_journal,
                    daily_check_in_enabled,
                    daily_check_in_time,
                    evening_review_enabled,
                    evening_review_time,
                    journal_check_in_cooldown_minutes,
                    show_mood_prompt,
                    show_energy_prompt,
                    active_hyperliquid_account_id,
                    autonomous_movement_enabled,
                    movement_intensity,
                    surface_interaction_enabled,
                    follow_moving_surfaces,
                    cursor_awareness_enabled,
                    multi_monitor_wandering_enabled,
                    conversation_compaction_enabled,
                    semantic_memory_enabled,
                    consolidation_enabled,
                    automatic_ordinary_learning_enabled,
                    embedding_model,
                    embed_sensitive_content,
                    continuity_recent_message_count
             FROM app_settings WHERE id = 1",
            [],
            |row| {
                let policy: String = row.get(2)?;
                let placement_mode: String = row.get(6)?;
                let free_x: Option<i32> = row.get(7)?;
                let free_y: Option<i32> = row.get(8)?;
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, i64>(1)?,
                    policy,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    placement_mode,
                    free_x,
                    free_y,
                    row.get::<_, i64>(9)?,
                    row.get::<_, i64>(10)?,
                    row.get::<_, i64>(11)?,
                    row.get::<_, i64>(12)?,
                    row.get::<_, i64>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, String>(15)?,
                    row.get::<_, i64>(16)?,
                    row.get::<_, i64>(17)?,
                    row.get::<_, i64>(18)?,
                    row.get::<_, i64>(19)?,
                    row.get::<_, i64>(20)?,
                    row.get::<_, i64>(21)?,
                    row.get::<_, String>(22)?,
                    row.get::<_, i64>(23)?,
                    row.get::<_, i64>(24)?,
                    row.get::<_, i64>(25)?,
                    row.get::<_, i64>(26)?,
                    row.get::<_, i64>(27)?,
                    row.get::<_, i64>(28)?,
                    row.get::<_, i64>(29)?,
                    row.get::<_, String>(30)?,
                    row.get::<_, i64>(31)?,
                    row.get::<_, i64>(32)?,
                    row.get::<_, i64>(33)?,
                    row.get::<_, Option<String>>(34)?,
                    row.get::<_, i64>(35)?,
                    row.get::<_, Option<String>>(36)?,
                    row.get::<_, i64>(37)?,
                    row.get::<_, i64>(38)?,
                    row.get::<_, i64>(39)?,
                    row.get::<_, Option<String>>(40)?,
                    row.get::<_, i64>(41)?,
                    row.get::<_, String>(42)?,
                    row.get::<_, i64>(43)?,
                    row.get::<_, i64>(44)?,
                    row.get::<_, i64>(45)?,
                    row.get::<_, i64>(46)?,
                    row.get::<_, i64>(47)?,
                    row.get::<_, i64>(48)?,
                    row.get::<_, i64>(49)?,
                    row.get::<_, i64>(50)?,
                    row.get::<_, String>(51)?,
                    row.get::<_, i64>(52)?,
                    row.get::<_, i64>(53)?,
                ))
            },
        )
        .map_err(StorageError::from_sql_read)
        .and_then(
            |(
                selected_local_model,
                animations,
                policy,
                last_opened_conversation_id,
                buddy_visible,
                buddy_always_on_top,
                placement_mode,
                free_x,
                free_y,
                reduced_movement_enabled,
                sleep_after_inactivity_seconds,
                proactive_checkins_enabled,
                proactive_checkin_cooldown_minutes,
                quiet_hours_enabled,
                quiet_hours_start,
                quiet_hours_end,
                do_not_disturb,
                global_shortcut_enabled,
                launch_at_login,
                open_companion_home_at_startup,
                bubble_width,
                memory_enabled,
                memory_approval_mode,
                allow_personal_memories,
                allow_sensitive_memories,
                show_memory_used_indicator,
                memory_candidate_notifications,
                temporary_memory_default_expiry_days,
                use_memories_in_temporary_chat,
                journaling_enabled,
                default_journal_mode,
                default_entry_private,
                allow_memory_candidates_from_journal,
                daily_check_in_enabled,
                daily_check_in_time,
                evening_review_enabled,
                evening_review_time,
                journal_check_in_cooldown_minutes,
                show_mood_prompt,
                show_energy_prompt,
                active_hyperliquid_account_id,
                autonomous_movement_enabled,
                movement_intensity,
                surface_interaction_enabled,
                follow_moving_surfaces,
                cursor_awareness_enabled,
                multi_monitor_wandering_enabled,
                conversation_compaction_enabled,
                semantic_memory_enabled,
                consolidation_enabled,
                automatic_ordinary_learning_enabled,
                embedding_model,
                embed_sensitive_content,
                continuity_recent_message_count,
            )| {
                let companion_preferences = CompanionPreferences {
                    buddy_visible: buddy_visible == 1,
                    buddy_always_on_top: buddy_always_on_top == 1,
                    placement_mode: CompanionPlacementMode::from_db(&placement_mode)?,
                    free_position: free_position(free_x, free_y),
                    ambient_animations_enabled: animations == 1,
                    reduced_movement_enabled: reduced_movement_enabled == 1,
                    autonomous_movement_enabled: autonomous_movement_enabled == 1,
                    movement_intensity: MovementIntensity::from_db(&movement_intensity)?,
                    surface_interaction_enabled: surface_interaction_enabled == 1,
                    follow_moving_surfaces: follow_moving_surfaces == 1,
                    cursor_awareness_enabled: cursor_awareness_enabled == 1,
                    multi_monitor_wandering_enabled: multi_monitor_wandering_enabled == 1,
                    sleep_after_inactivity_seconds: bounded_u32(
                        sleep_after_inactivity_seconds,
                        "sleep-after-inactivity setting",
                    )?,
                    proactive_checkins_enabled: proactive_checkins_enabled == 1,
                    proactive_checkin_cooldown_minutes: bounded_u32(
                        proactive_checkin_cooldown_minutes,
                        "proactive cooldown setting",
                    )?,
                    quiet_hours_enabled: quiet_hours_enabled == 1,
                    quiet_hours_start,
                    quiet_hours_end,
                    do_not_disturb: do_not_disturb == 1,
                    global_shortcut_enabled: global_shortcut_enabled == 1,
                    launch_at_login: launch_at_login == 1,
                    open_companion_home_at_startup: open_companion_home_at_startup == 1,
                    bubble_width: bounded_u32(bubble_width, "bubble width setting")?,
                };
                validate_companion_preferences(&companion_preferences)?;
                let memory_preferences = MemoryPreferences {
                    memory_enabled: memory_enabled == 1,
                    memory_approval_mode: MemoryApprovalMode::from_db(&memory_approval_mode)?,
                    allow_personal_memories: allow_personal_memories == 1,
                    allow_sensitive_memories: allow_sensitive_memories == 1,
                    show_memory_used_indicator: show_memory_used_indicator == 1,
                    memory_candidate_notifications: memory_candidate_notifications == 1,
                    temporary_memory_default_expiry_days: bounded_u32(
                        temporary_memory_default_expiry_days,
                        "temporary memory expiry setting",
                    )?,
                    use_memories_in_temporary_chat: use_memories_in_temporary_chat == 1,
                };
                validate_memory_preferences(&memory_preferences)?;
                let journal_preferences = JournalPreferences {
                    journaling_enabled: journaling_enabled == 1,
                    default_journal_mode: JournalMode::from_db(&default_journal_mode)?,
                    default_entry_private: default_entry_private == 1,
                    allow_memory_candidates_from_journal: allow_memory_candidates_from_journal == 1,
                    daily_check_in_enabled: daily_check_in_enabled == 1,
                    daily_check_in_time,
                    evening_review_enabled: evening_review_enabled == 1,
                    evening_review_time,
                    journal_check_in_cooldown_minutes: bounded_u32(
                        journal_check_in_cooldown_minutes,
                        "journal check-in cooldown setting",
                    )?,
                    show_mood_prompt: show_mood_prompt == 1,
                    show_energy_prompt: show_energy_prompt == 1,
                };
                validate_journal_preferences(&journal_preferences)?;
                let continuity_preferences = ContinuityPreferences {
                    conversation_compaction_enabled: conversation_compaction_enabled == 1,
                    semantic_memory_enabled: semantic_memory_enabled == 1,
                    consolidation_enabled: consolidation_enabled == 1,
                    automatic_ordinary_learning_enabled: automatic_ordinary_learning_enabled == 1,
                    embedding_model,
                    embed_sensitive_content: embed_sensitive_content == 1,
                    recent_message_count: bounded_u32(
                        continuity_recent_message_count,
                        "continuity recent-message setting",
                    )?,
                };
                validate_continuity_preferences(&continuity_preferences)?;
                Ok(AppSettings {
                    selected_local_model,
                    ambient_animations_enabled: animations == 1,
                    conversation_retention_policy: ConversationRetentionPolicy::from_db(&policy)?,
                    last_opened_conversation_id,
                    active_hyperliquid_account_id,
                    companion_preferences,
                    memory_preferences,
                    journal_preferences,
                    continuity_preferences,
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

pub fn set_companion_preferences(
    connection: &Connection,
    preferences: CompanionPreferences,
) -> Result<AppSettings, StorageError> {
    validate_companion_preferences(&preferences)?;
    let (free_x, free_y) = preferences
        .free_position
        .map(|position| (Some(position.x), Some(position.y)))
        .unwrap_or((None, None));
    connection
        .execute(
            "UPDATE app_settings
             SET ambient_animations_enabled = ?1,
                 buddy_visible = ?2,
                 buddy_always_on_top = ?3,
                 buddy_placement_mode = ?4,
                 buddy_free_position_x = ?5,
                 buddy_free_position_y = ?6,
                 reduced_movement_enabled = ?7,
                 sleep_after_inactivity_seconds = ?8,
                 proactive_checkins_enabled = ?9,
                 proactive_checkin_cooldown_minutes = ?10,
                 quiet_hours_enabled = ?11,
                 quiet_hours_start = ?12,
                 quiet_hours_end = ?13,
                 do_not_disturb = ?14,
                 global_shortcut_enabled = ?15,
                 launch_at_login = ?16,
                 open_companion_home_at_startup = ?17,
                 bubble_width = ?18,
                 autonomous_movement_enabled = ?19,
                 movement_intensity = ?20,
                 surface_interaction_enabled = ?21,
                 follow_moving_surfaces = ?22,
                 cursor_awareness_enabled = ?23,
                 multi_monitor_wandering_enabled = ?24
             WHERE id = 1",
            params![
                bool_to_db(preferences.ambient_animations_enabled),
                bool_to_db(preferences.buddy_visible),
                bool_to_db(preferences.buddy_always_on_top),
                preferences.placement_mode.as_db(),
                free_x,
                free_y,
                bool_to_db(preferences.reduced_movement_enabled),
                preferences.sleep_after_inactivity_seconds,
                bool_to_db(preferences.proactive_checkins_enabled),
                preferences.proactive_checkin_cooldown_minutes,
                bool_to_db(preferences.quiet_hours_enabled),
                preferences.quiet_hours_start,
                preferences.quiet_hours_end,
                bool_to_db(preferences.do_not_disturb),
                bool_to_db(preferences.global_shortcut_enabled),
                bool_to_db(preferences.launch_at_login),
                bool_to_db(preferences.open_companion_home_at_startup),
                preferences.bubble_width,
                bool_to_db(preferences.autonomous_movement_enabled),
                preferences.movement_intensity.as_db(),
                bool_to_db(preferences.surface_interaction_enabled),
                bool_to_db(preferences.follow_moving_surfaces),
                bool_to_db(preferences.cursor_awareness_enabled),
                bool_to_db(preferences.multi_monitor_wandering_enabled),
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    settings(connection)
}

pub fn set_memory_preferences(
    connection: &Connection,
    preferences: MemoryPreferences,
) -> Result<AppSettings, StorageError> {
    validate_memory_preferences(&preferences)?;
    connection
        .execute(
            "UPDATE app_settings
             SET memory_enabled = ?1,
                 memory_approval_mode = ?2,
                 allow_personal_memories = ?3,
                 allow_sensitive_memories = ?4,
                 show_memory_used_indicator = ?5,
                 memory_candidate_notifications = ?6,
                 temporary_memory_default_expiry_days = ?7,
                 use_memories_in_temporary_chat = ?8
             WHERE id = 1",
            params![
                bool_to_db(preferences.memory_enabled),
                preferences.memory_approval_mode.as_db(),
                bool_to_db(preferences.allow_personal_memories),
                bool_to_db(preferences.allow_sensitive_memories),
                bool_to_db(preferences.show_memory_used_indicator),
                bool_to_db(preferences.memory_candidate_notifications),
                preferences.temporary_memory_default_expiry_days,
                bool_to_db(preferences.use_memories_in_temporary_chat),
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    settings(connection)
}

pub fn set_journal_preferences(
    connection: &Connection,
    preferences: JournalPreferences,
) -> Result<AppSettings, StorageError> {
    validate_journal_preferences(&preferences)?;
    connection
        .execute(
            "UPDATE app_settings
             SET journaling_enabled = ?1,
                 default_journal_mode = ?2,
                 default_entry_private = ?3,
                 allow_memory_candidates_from_journal = ?4,
                 daily_check_in_enabled = ?5,
                 daily_check_in_time = ?6,
                 evening_review_enabled = ?7,
                 evening_review_time = ?8,
                 journal_check_in_cooldown_minutes = ?9,
                 show_mood_prompt = ?10,
                 show_energy_prompt = ?11
             WHERE id = 1",
            params![
                bool_to_db(preferences.journaling_enabled),
                preferences.default_journal_mode.as_db(),
                bool_to_db(preferences.default_entry_private),
                bool_to_db(preferences.allow_memory_candidates_from_journal),
                bool_to_db(preferences.daily_check_in_enabled),
                preferences.daily_check_in_time,
                bool_to_db(preferences.evening_review_enabled),
                preferences.evening_review_time,
                preferences.journal_check_in_cooldown_minutes,
                bool_to_db(preferences.show_mood_prompt),
                bool_to_db(preferences.show_energy_prompt),
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    settings(connection)
}

pub fn set_continuity_preferences(
    connection: &Connection,
    preferences: ContinuityPreferences,
) -> Result<AppSettings, StorageError> {
    validate_continuity_preferences(&preferences)?;
    connection
        .execute(
            "UPDATE app_settings
             SET conversation_compaction_enabled = ?1,
                 semantic_memory_enabled = ?2,
                 consolidation_enabled = ?3,
                 automatic_ordinary_learning_enabled = ?4,
                 embedding_model = ?5,
                 embed_sensitive_content = ?6,
                 continuity_recent_message_count = ?7
             WHERE id = 1",
            params![
                bool_to_db(preferences.conversation_compaction_enabled),
                bool_to_db(preferences.semantic_memory_enabled),
                bool_to_db(preferences.consolidation_enabled),
                bool_to_db(preferences.automatic_ordinary_learning_enabled),
                preferences.embedding_model,
                bool_to_db(preferences.embed_sensitive_content),
                preferences.recent_message_count,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    settings(connection)
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

pub fn create_memory(connection: &Connection, draft: MemoryDraft) -> Result<Memory, StorageError> {
    validate_memory_draft(&draft)?;
    let now = timestamp();
    let id = generate_id("memory");
    let normalized = normalize_memory_content(&draft.content);
    let confirmed_at = if draft.status == MemoryStatus::Confirmed {
        Some(now.clone())
    } else {
        None
    };
    connection
        .execute(
            "INSERT INTO memories (
                id, category, content, normalized_content, status, source_kind,
                source_conversation_id, source_message_id, confidence, importance, sensitivity,
                created_at, updated_at, confirmed_at, expires_at, supersedes_memory_id
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                id,
                draft.category.as_db(),
                draft.content.trim(),
                normalized,
                draft.status.as_db(),
                draft.source_kind.as_db(),
                draft.source_conversation_id,
                draft.source_message_id,
                draft.confidence.clamp(0.0, 1.0),
                draft.importance.clamp(0.0, 1.0),
                draft.sensitivity.as_db(),
                now,
                now,
                confirmed_at,
                draft.expires_at,
                draft.supersedes_memory_id,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    get_memory(connection, &id)
}

pub fn get_memory(connection: &Connection, memory_id: &str) -> Result<Memory, StorageError> {
    validate_identifier(memory_id, "memory ID")?;
    connection
        .query_row(
            "SELECT id, category, content, normalized_content, status, source_kind,
                    source_conversation_id, source_message_id, confidence, importance, sensitivity,
                    created_at, updated_at, confirmed_at, last_used_at, use_count, expires_at,
                    supersedes_memory_id
             FROM memories WHERE id = ?1",
            params![memory_id],
            map_memory,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => {
                StorageError::invalid_request("Memory was not found.")
            }
            other => StorageError::from_sql_read(other),
        })
}

pub fn list_memories(
    connection: &Connection,
    options: MemoryListOptions,
) -> Result<Vec<Memory>, StorageError> {
    let limit = options.limit.clamp(1, MAX_PAGE_LIMIT);
    if let Some(query) = &options.query {
        validate_memory_search(query)?;
    }
    let status = options.status.as_ref().map(MemoryStatus::as_db);
    let category = options.category.as_ref().map(MemoryCategory::as_db);
    let sensitivity = options.sensitivity.as_ref().map(MemorySensitivity::as_db);
    let query = options
        .query
        .as_ref()
        .map(|value| format!("%{}%", normalize_memory_content(value)));
    let mut statement = connection
        .prepare(
            "SELECT id, category, content, normalized_content, status, source_kind,
                    source_conversation_id, source_message_id, confidence, importance, sensitivity,
                    created_at, updated_at, confirmed_at, last_used_at, use_count, expires_at,
                    supersedes_memory_id
             FROM memories
             WHERE (?1 IS NULL OR status = ?1)
               AND (?2 IS NULL OR category = ?2)
               AND (?3 IS NULL OR sensitivity = ?3)
               AND (?4 IS NULL OR normalized_content LIKE ?4)
             ORDER BY updated_at DESC, id ASC
             LIMIT ?5",
        )
        .map_err(StorageError::from_sql_read)?;
    let memories = collect_rows(
        statement
            .query_map(
                params![status, category, sensitivity, query, limit],
                map_memory,
            )
            .map_err(StorageError::from_sql_read)?,
    )?;
    Ok(memories)
}

pub fn confirm_memory(connection: &Connection, memory_id: &str) -> Result<Memory, StorageError> {
    update_memory_status(connection, memory_id, MemoryStatus::Confirmed)
}

pub fn reject_memory(connection: &Connection, memory_id: &str) -> Result<Memory, StorageError> {
    update_memory_status(connection, memory_id, MemoryStatus::Rejected)
}

pub fn restore_memory(connection: &Connection, memory_id: &str) -> Result<Memory, StorageError> {
    update_memory_status(connection, memory_id, MemoryStatus::Confirmed)
}

pub fn update_memory_expiry(
    connection: &Connection,
    memory_id: &str,
    expires_at: Option<String>,
) -> Result<Memory, StorageError> {
    validate_identifier(memory_id, "memory ID")?;
    let now = timestamp();
    let changed = connection
        .execute(
            "UPDATE memories
             SET expires_at = ?1,
                 status = CASE WHEN status = 'expired' THEN 'confirmed' ELSE status END,
                 updated_at = ?2
             WHERE id = ?3",
            params![expires_at, now, memory_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Memory was not found."));
    }
    get_memory(connection, memory_id)
}

pub fn supersede_memory(
    connection: &mut Connection,
    previous_memory_id: &str,
    replacement: MemoryDraft,
) -> Result<Memory, StorageError> {
    validate_identifier(previous_memory_id, "previous memory ID")?;
    validate_memory_draft(&replacement)?;
    let previous = get_memory(connection, previous_memory_id)?;
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    transaction
        .execute(
            "UPDATE memories
             SET status = 'superseded',
                 updated_at = ?1
             WHERE id = ?2",
            params![now, previous_memory_id],
        )
        .map_err(StorageError::from_sql_write)?;
    let id = generate_id("memory");
    let normalized = normalize_memory_content(&replacement.content);
    let confirmed_at = if replacement.status == MemoryStatus::Confirmed {
        Some(now.clone())
    } else {
        None
    };
    transaction
        .execute(
            "INSERT INTO memories (
                id, category, content, normalized_content, status, source_kind,
                source_conversation_id, source_message_id, confidence, importance, sensitivity,
                created_at, updated_at, confirmed_at, expires_at, supersedes_memory_id
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                id,
                replacement.category.as_db(),
                replacement.content.trim(),
                normalized,
                replacement.status.as_db(),
                replacement.source_kind.as_db(),
                replacement.source_conversation_id,
                replacement.source_message_id,
                replacement.confidence.clamp(0.0, 1.0),
                replacement
                    .importance
                    .clamp(0.0, 1.0)
                    .max(previous.importance),
                replacement.sensitivity.as_db(),
                now,
                now,
                confirmed_at,
                replacement.expires_at,
                previous_memory_id,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    get_memory(connection, &id)
}

pub fn update_memory_content(
    connection: &Connection,
    memory_id: &str,
    content: String,
    category: MemoryCategory,
    sensitivity: MemorySensitivity,
    expires_at: Option<String>,
) -> Result<Memory, StorageError> {
    validate_identifier(memory_id, "memory ID")?;
    validate_memory_content(&content)?;
    if sensitivity == MemorySensitivity::Prohibited {
        return Err(StorageError::invalid_request(
            "Secrets and prohibited content cannot be stored in memory.",
        ));
    }
    let now = timestamp();
    connection
        .execute(
            "UPDATE memories
             SET content = ?1,
                 normalized_content = ?2,
                 category = ?3,
                 sensitivity = ?4,
                 expires_at = ?5,
                 updated_at = ?6
             WHERE id = ?7",
            params![
                content.trim(),
                normalize_memory_content(&content),
                category.as_db(),
                sensitivity.as_db(),
                expires_at,
                now,
                memory_id,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    get_memory(connection, memory_id)
}

pub fn delete_memory(connection: &Connection, memory_id: &str) -> Result<(), StorageError> {
    validate_identifier(memory_id, "memory ID")?;
    let changed = connection
        .execute("DELETE FROM memories WHERE id = ?1", params![memory_id])
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Memory was not found."));
    }
    Ok(())
}

pub fn delete_all_memories(
    connection: &mut Connection,
) -> Result<DeleteAllMemoriesResult, StorageError> {
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let deleted = transaction
        .execute("DELETE FROM memories", [])
        .map_err(StorageError::from_sql_write)? as u32;
    transaction
        .execute("DELETE FROM memory_usage_records", [])
        .map_err(StorageError::from_sql_write)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(DeleteAllMemoriesResult {
        deleted_memories: deleted,
    })
}

pub fn cleanup_expired_memories(connection: &Connection) -> Result<u32, StorageError> {
    let now = timestamp();
    let changed = connection
        .execute(
            "UPDATE memories
             SET status = 'expired', updated_at = ?1
             WHERE status IN ('proposed', 'confirmed')
               AND expires_at IS NOT NULL
               AND expires_at <= ?1",
            params![now],
        )
        .map_err(StorageError::from_sql_write)? as u32;
    Ok(changed)
}

pub fn retrieve_memories(
    connection: &Connection,
    query: &str,
    limit: u32,
    include_sensitive: bool,
) -> Result<Vec<RetrievedMemory>, StorageError> {
    validate_memory_search(query)?;
    let normalized_query = normalize_memory_content(query);
    let tokens = memory_query_tokens(&normalized_query);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }
    let now = timestamp();
    let fts_query = tokens
        .iter()
        .map(|token| format!("{token}*"))
        .collect::<Vec<_>>()
        .join(" OR ");
    let mut statement = connection
        .prepare(
            "SELECT m.id, m.category, m.content, m.normalized_content, m.status, m.source_kind,
                    m.source_conversation_id, m.source_message_id, m.confidence, m.importance,
                    m.sensitivity, m.created_at, m.updated_at, m.confirmed_at, m.last_used_at,
                    m.use_count, m.expires_at, m.supersedes_memory_id
             FROM memory_fts
             JOIN memories m ON m.id = memory_fts.memory_id
             WHERE memory_fts MATCH ?1
               AND m.status = 'confirmed'
               AND (m.expires_at IS NULL OR m.expires_at > ?2)
               AND (?3 = 1 OR m.sensitivity != 'sensitive')",
        )
        .map_err(StorageError::from_sql_read)?;
    let memories = collect_rows(
        statement
            .query_map(
                params![fts_query, now, bool_to_db(include_sensitive)],
                map_memory,
            )
            .map_err(StorageError::from_sql_read)?,
    )?;
    let mut retrieved: Vec<RetrievedMemory> = memories
        .into_iter()
        .filter_map(|memory| {
            let overlap_count = tokens
                .iter()
                .filter(|token| memory.normalized_content.contains(token.as_str()))
                .count();
            if overlap_count == 0 {
                return None;
            }
            let mut reasons = vec!["keyword_overlap".to_owned()];
            if memory.normalized_content.contains(&normalized_query) {
                reasons.push("exact_phrase".to_owned());
            }
            if memory.importance >= 0.75 {
                reasons.push("high_importance".to_owned());
            }
            if memory.last_used_at.is_some() {
                reasons.push("recent_usage".to_owned());
            }
            let score = overlap_count as f64
                + memory.importance
                + (memory.use_count as f64 * 0.02).min(0.2);
            Some(RetrievedMemory {
                id: memory.id,
                category: memory.category,
                content: memory.content,
                sensitivity: memory.sensitivity,
                score,
                match_reasons: reasons,
            })
        })
        .collect();
    retrieved.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.id.cmp(&b.id))
    });
    retrieved.truncate(limit.clamp(1, 8) as usize);
    Ok(retrieved)
}

pub fn record_memory_usage(
    connection: &Connection,
    request: MemoryUsageRequest,
) -> Result<(), StorageError> {
    validate_identifier(&request.conversation_id, "conversation ID")?;
    for memory_id in &request.memory_ids {
        validate_identifier(memory_id, "memory ID")?;
    }
    let now = timestamp();
    for memory_id in request.memory_ids {
        let usage_id = generate_id("memory_usage");
        connection
            .execute(
                "INSERT INTO memory_usage_records (
                    id, memory_id, conversation_id, assistant_message_id, used_at, reason_code
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    usage_id,
                    memory_id,
                    request.conversation_id.as_str(),
                    request.assistant_message_id.as_deref(),
                    now,
                    truncate_chars(&request.reason_code, 80),
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        connection
            .execute(
                "UPDATE memories
                 SET last_used_at = ?1, use_count = use_count + 1
                 WHERE id = ?2",
                params![now, memory_id],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    Ok(())
}

pub fn list_memory_usage_records(
    connection: &Connection,
    memory_id: Option<String>,
    limit: u32,
) -> Result<Vec<MemoryUsageRecord>, StorageError> {
    if let Some(id) = &memory_id {
        validate_identifier(id, "memory ID")?;
    }
    let limit = limit.clamp(1, MAX_PAGE_LIMIT);
    let mut statement = connection
        .prepare(
            "SELECT id, memory_id, conversation_id, assistant_message_id, used_at, reason_code
             FROM memory_usage_records
             WHERE (?1 IS NULL OR memory_id = ?1)
             ORDER BY used_at DESC, id ASC
             LIMIT ?2",
        )
        .map_err(StorageError::from_sql_read)?;
    let usage_records = collect_rows(
        statement
            .query_map(params![memory_id, limit], |row| {
                Ok(MemoryUsageRecord {
                    id: row.get(0)?,
                    memory_id: row.get(1)?,
                    conversation_id: row.get(2)?,
                    assistant_message_id: row.get(3)?,
                    used_at: row.get(4)?,
                    reason_code: row.get(5)?,
                })
            })
            .map_err(StorageError::from_sql_read)?,
    )?;
    Ok(usage_records)
}

pub fn export_memory_file(
    connection: &Connection,
    include_sensitive: bool,
) -> Result<MemoryExportFile, StorageError> {
    let settings = settings(connection)?;
    let mut memories = list_memories(
        connection,
        MemoryListOptions {
            status: Some(MemoryStatus::Confirmed),
            category: None,
            sensitivity: None,
            query: None,
            limit: MAX_PAGE_LIMIT,
        },
    )?;
    memories.retain(|memory| {
        memory.sensitivity != MemorySensitivity::Prohibited
            && (include_sensitive || memory.sensitivity != MemorySensitivity::Sensitive)
    });
    Ok(MemoryExportFile {
        format: "trading-buddy-memories".to_owned(),
        version: 1,
        exported_at: timestamp(),
        settings: settings.memory_preferences,
        memories,
    })
}

pub fn create_journal_entry(
    connection: &mut Connection,
    draft: JournalEntryDraft,
) -> Result<JournalEntry, StorageError> {
    validate_journal_draft(&draft)?;
    let now = timestamp();
    let id = generate_id("journal");
    let occurred_at = draft.occurred_at.unwrap_or_else(|| now.clone());
    let completed_at = if draft.status == JournalStatus::Completed {
        Some(now.clone())
    } else {
        None
    };
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    transaction
        .execute(
            "INSERT INTO journal_entries (
                id, kind, title, body, summary, status, source_kind, source_conversation_id,
                source_message_id, mood, energy, stress, confidence, occurred_at, created_at,
                updated_at, completed_at, allow_memory_candidates, is_private
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
            params![
                id,
                draft.kind.as_db(),
                truncate_chars(draft.title.trim(), MAX_JOURNAL_TITLE_LENGTH),
                draft.body.trim(),
                draft.summary.as_deref().map(str::trim),
                draft.status.as_db(),
                draft.source_kind.as_db(),
                draft.source_conversation_id,
                draft.source_message_id,
                draft.mood,
                draft.energy,
                draft.stress,
                draft.confidence,
                occurred_at,
                now,
                now,
                completed_at,
                bool_to_db(draft.allow_memory_candidates),
                bool_to_db(draft.is_private),
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    set_journal_tags(&transaction, &id, &draft.tags)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    get_journal_entry(connection, &id)
}

pub fn update_journal_entry(
    connection: &mut Connection,
    update: JournalEntryUpdate,
) -> Result<JournalEntry, StorageError> {
    validate_identifier(&update.entry_id, "journal entry ID")?;
    validate_journal_update(&update)?;
    let now = timestamp();
    let completed_at = if update.status == JournalStatus::Completed {
        Some(now.clone())
    } else {
        None
    };
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let changed = transaction
        .execute(
            "UPDATE journal_entries
             SET kind = ?1,
                 title = ?2,
                 body = ?3,
                 summary = ?4,
                 status = ?5,
                 mood = ?6,
                 energy = ?7,
                 stress = ?8,
                 confidence = ?9,
                 updated_at = ?10,
                 completed_at = CASE WHEN ?5 = 'completed' THEN COALESCE(completed_at, ?11) ELSE NULL END,
                 allow_memory_candidates = ?12,
                 is_private = ?13
             WHERE id = ?14 AND updated_at = ?15",
            params![
                update.kind.as_db(),
                truncate_chars(update.title.trim(), MAX_JOURNAL_TITLE_LENGTH),
                update.body.trim(),
                update.summary.as_deref().map(str::trim),
                update.status.as_db(),
                update.mood,
                update.energy,
                update.stress,
                update.confidence,
                now,
                completed_at,
                bool_to_db(update.allow_memory_candidates),
                bool_to_db(update.is_private),
                update.entry_id,
                update.expected_updated_at,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Journal entry changed before this save completed. Reload and try again.",
        ));
    }
    set_journal_tags(&transaction, &update.entry_id, &update.tags)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    get_journal_entry(connection, &update.entry_id)
}

pub fn get_journal_entry(
    connection: &Connection,
    entry_id: &str,
) -> Result<JournalEntry, StorageError> {
    validate_identifier(entry_id, "journal entry ID")?;
    let mut entry = connection
        .query_row(
            "SELECT id, kind, title, body, summary, status, source_kind, source_conversation_id,
                    source_message_id, mood, energy, stress, confidence, occurred_at, created_at,
                    updated_at, completed_at, allow_memory_candidates, is_private
             FROM journal_entries WHERE id = ?1",
            params![entry_id],
            map_journal_entry_without_tags,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => {
                StorageError::invalid_request("Journal entry was not found.")
            }
            other => StorageError::from_sql_read(other),
        })?;
    entry.tags = journal_tags_for_entry(connection, entry_id)?;
    Ok(entry)
}

pub fn list_journal_entries(
    connection: &Connection,
    options: JournalListOptions,
) -> Result<Vec<JournalEntrySummary>, StorageError> {
    let limit = options.limit.clamp(1, MAX_PAGE_LIMIT);
    let offset = options.offset.min(10_000);
    if let Some(query) = &options.query {
        validate_journal_search(query)?;
    }
    let status = options.status.as_ref().map(JournalStatus::as_db);
    let kind = options.kind.as_ref().map(JournalKind::as_db);
    let tag = options
        .tag
        .as_ref()
        .map(|value| normalize_journal_tag(value));
    if let Some(value) = &tag {
        validate_normalized_journal_tag(value)?;
    }
    let order = match options.sort {
        JournalSort::Newest => "DESC",
        JournalSort::Oldest => "ASC",
    };
    let mut sql = "SELECT e.id, e.kind, e.title, substr(e.body, 1, 220), e.summary, e.status,
                e.occurred_at, e.updated_at, e.is_private, e.allow_memory_candidates,
                e.mood, e.energy
         FROM journal_entries e
         WHERE (?1 IS NULL OR e.status = ?1)
           AND (?2 IS NULL OR e.kind = ?2)
           AND (?3 = 1 OR e.is_private = 0)
           AND (?4 = 1 OR e.status != 'discarded')
           AND (?5 IS NULL OR e.occurred_at >= ?5)
           AND (?6 IS NULL OR e.occurred_at <= ?6)
           AND (?7 IS NULL OR EXISTS (
             SELECT 1 FROM journal_entry_tags jet
             JOIN journal_tags jt ON jt.id = jet.tag_id
             WHERE jet.entry_id = e.id AND jt.value = ?7
           ))"
    .to_owned();
    if options
        .query
        .as_ref()
        .is_some_and(|query| !query.trim().is_empty())
    {
        sql.push_str(
            " AND e.id IN (
                SELECT entry_id FROM journal_fts WHERE journal_fts MATCH ?8
              )",
        );
    }
    sql.push_str(&format!(
        " ORDER BY e.occurred_at {order}, e.id ASC LIMIT ?9 OFFSET ?10"
    ));
    let fts_query = options
        .query
        .as_ref()
        .map(|query| journal_fts_query(query))
        .unwrap_or_default();
    let mut statement = connection
        .prepare(&sql)
        .map_err(StorageError::from_sql_read)?;
    let mut summaries = collect_rows(
        statement
            .query_map(
                params![
                    status,
                    kind,
                    bool_to_db(options.include_private),
                    bool_to_db(options.include_discarded),
                    options.from_date,
                    options.to_date,
                    tag,
                    fts_query,
                    limit,
                    offset,
                ],
                |row| {
                    Ok(JournalEntrySummary {
                        id: row.get(0)?,
                        kind: JournalKind::from_db(row.get::<_, String>(1)?.as_str())
                            .map_err(to_sql_conversion_error)?,
                        title: row.get(2)?,
                        preview: row.get(3)?,
                        summary: row.get(4)?,
                        status: JournalStatus::from_db(row.get::<_, String>(5)?.as_str())
                            .map_err(to_sql_conversion_error)?,
                        occurred_at: row.get(6)?,
                        updated_at: row.get(7)?,
                        is_private: row.get::<_, i64>(8)? == 1,
                        allow_memory_candidates: row.get::<_, i64>(9)? == 1,
                        tags: Vec::new(),
                        mood: row.get(10)?,
                        energy: row.get(11)?,
                    })
                },
            )
            .map_err(StorageError::from_sql_read)?,
    )?;
    for summary in &mut summaries {
        summary.tags = journal_tags_for_entry(connection, &summary.id)?;
    }
    Ok(summaries)
}

pub fn delete_journal_entry(connection: &Connection, entry_id: &str) -> Result<(), StorageError> {
    validate_identifier(entry_id, "journal entry ID")?;
    let changed = connection
        .execute(
            "DELETE FROM journal_entries WHERE id = ?1",
            params![entry_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Journal entry was not found.",
        ));
    }
    connection
        .execute(
            "DELETE FROM journal_tags
             WHERE id NOT IN (SELECT DISTINCT tag_id FROM journal_entry_tags)",
            [],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn delete_all_journal_entries(
    connection: &mut Connection,
) -> Result<DeleteAllJournalResult, StorageError> {
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let deleted = transaction
        .execute("DELETE FROM journal_entries", [])
        .map_err(StorageError::from_sql_write)? as u32;
    transaction
        .execute(
            "DELETE FROM journal_tags
             WHERE id NOT IN (SELECT DISTINCT tag_id FROM journal_entry_tags)",
            [],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(DeleteAllJournalResult {
        deleted_entries: deleted,
    })
}

pub fn export_journal_file(
    connection: &Connection,
    include_private: bool,
) -> Result<JournalExportFile, StorageError> {
    let summaries = list_journal_entries(
        connection,
        JournalListOptions {
            status: None,
            kind: None,
            query: None,
            tag: None,
            from_date: None,
            to_date: None,
            include_private,
            include_discarded: false,
            sort: JournalSort::Newest,
            limit: MAX_PAGE_LIMIT,
            offset: 0,
        },
    )?;
    let mut entries = Vec::new();
    for summary in summaries {
        entries.push(get_journal_entry(connection, &summary.id)?);
    }
    Ok(JournalExportFile {
        format: "trading-buddy-journal".to_owned(),
        version: 1,
        exported_at: timestamp(),
        entries,
    })
}

pub fn journal_diagnostics(connection: &Connection) -> Result<JournalDiagnostics, StorageError> {
    let count_status = |status: &str| -> Result<u32, StorageError> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM journal_entries WHERE status = ?1",
                params![status],
                |row| row.get::<_, u32>(0),
            )
            .map_err(StorageError::from_sql_read)
    };
    let total_count = connection
        .query_row("SELECT COUNT(*) FROM journal_entries", [], |row| {
            row.get::<_, u32>(0)
        })
        .map_err(StorageError::from_sql_read)?;
    let private_count = connection
        .query_row(
            "SELECT COUNT(*) FROM journal_entries WHERE is_private = 1",
            [],
            |row| row.get::<_, u32>(0),
        )
        .map_err(StorageError::from_sql_read)?;
    let fixture_count = connection
        .query_row(
            "SELECT COUNT(*) FROM journal_entries
             WHERE source_kind = 'user_created'
               AND title LIKE 'Development journal fixture %'",
            [],
            |row| row.get::<_, u32>(0),
        )
        .map_err(StorageError::from_sql_read)?;
    let tag_count = connection
        .query_row("SELECT COUNT(*) FROM journal_tags", [], |row| {
            row.get::<_, u32>(0)
        })
        .map_err(StorageError::from_sql_read)?;
    let fts_available = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'journal_fts'",
            [],
            |row| row.get::<_, u32>(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?
        .is_some();
    Ok(JournalDiagnostics {
        total_count,
        draft_count: count_status("draft")?,
        completed_count: count_status("completed")?,
        discarded_count: count_status("discarded")?,
        private_count,
        fixture_count,
        tag_count,
        fts_available,
    })
}

pub fn create_development_journal_fixtures(
    connection: &mut Connection,
    requested_count: u32,
) -> Result<DevelopmentJournalFixtureResult, StorageError> {
    let count = requested_count.clamp(1, 1_000);
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    for index in 0..count {
        let id = generate_id("journal");
        let kind = match index % 5 {
            0 => JournalKind::FreeReflection,
            1 => JournalKind::DailyCheckIn,
            2 => JournalKind::Idea,
            3 => JournalKind::TradingSession,
            _ => JournalKind::EndOfDayReview,
        };
        let title = format!("Development journal fixture {:04}", index + 1);
        let body = format!(
            "Development fixture journal entry {}. This is synthetic local QA data with unicode 🌙 and bounded content.",
            index + 1
        );
        transaction
            .execute(
                "INSERT INTO journal_entries (
                    id, kind, title, body, status, source_kind, occurred_at, created_at, updated_at,
                    completed_at, allow_memory_candidates, is_private
                 ) VALUES (?1, ?2, ?3, ?4, ?5, 'user_created', ?6, ?7, ?8, ?9, 0, 1)",
                params![
                    id,
                    kind.as_db(),
                    title,
                    body,
                    if index % 9 == 0 { "draft" } else { "completed" },
                    now,
                    now,
                    now,
                    if index % 9 == 0 {
                        None::<String>
                    } else {
                        Some(now.clone())
                    },
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        set_journal_tags(&transaction, &id, &["fixture".to_owned(), "qa".to_owned()])?;
    }
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(DevelopmentJournalFixtureResult {
        created_entries: count,
        deleted_entries: 0,
    })
}

pub fn delete_development_journal_fixtures(
    connection: &Connection,
) -> Result<DevelopmentJournalFixtureResult, StorageError> {
    let deleted = connection
        .execute(
            "DELETE FROM journal_entries
             WHERE source_kind = 'user_created'
               AND title LIKE 'Development journal fixture %'",
            [],
        )
        .map_err(StorageError::from_sql_write)? as u32;
    connection
        .execute(
            "DELETE FROM journal_tags
             WHERE id NOT IN (SELECT DISTINCT tag_id FROM journal_entry_tags)",
            [],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(DevelopmentJournalFixtureResult {
        created_entries: 0,
        deleted_entries: deleted,
    })
}

pub fn memory_diagnostics(connection: &Connection) -> Result<MemoryDiagnostics, StorageError> {
    let count_for = |status: &str| -> Result<u32, StorageError> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM memories WHERE status = ?1",
                params![status],
                |row| row.get::<_, u32>(0),
            )
            .map_err(StorageError::from_sql_read)
    };
    let total_count = connection
        .query_row("SELECT COUNT(*) FROM memories", [], |row| {
            row.get::<_, u32>(0)
        })
        .map_err(StorageError::from_sql_read)?;
    let sensitive_count = connection
        .query_row(
            "SELECT COUNT(*) FROM memories WHERE sensitivity = 'sensitive'",
            [],
            |row| row.get::<_, u32>(0),
        )
        .map_err(StorageError::from_sql_read)?;
    let fixture_count = connection
        .query_row(
            "SELECT COUNT(*) FROM memories WHERE source_kind = 'system_observation'
               AND normalized_content LIKE 'development fixture memory %'",
            [],
            |row| row.get::<_, u32>(0),
        )
        .map_err(StorageError::from_sql_read)?;
    let fts_available = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'memory_fts'",
            [],
            |row| row.get::<_, u32>(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?
        .is_some();
    Ok(MemoryDiagnostics {
        total_count,
        proposed_count: count_for("proposed")?,
        confirmed_count: count_for("confirmed")?,
        rejected_count: count_for("rejected")?,
        expired_count: count_for("expired")?,
        superseded_count: count_for("superseded")?,
        sensitive_count,
        fts_available,
        fixture_count,
    })
}

pub fn create_development_memory_fixtures(
    connection: &mut Connection,
    requested_count: u32,
) -> Result<DevelopmentMemoryFixtureResult, StorageError> {
    let count = requested_count.clamp(1, 1_000);
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    for index in 0..count {
        let id = generate_id("memory");
        let category = match index % 5 {
            0 => MemoryCategory::Preference,
            1 => MemoryCategory::RiskRule,
            2 => MemoryCategory::Project,
            3 => MemoryCategory::Routine,
            _ => MemoryCategory::ImportantContext,
        };
        let content = format!(
            "Development fixture memory {:04}: user prefers bounded memory QA scenario {}.",
            index + 1,
            index % 17
        );
        let normalized_content = normalize_memory_content(&content);
        transaction
            .execute(
                "INSERT INTO memories (
                    id, category, content, normalized_content, status, source_kind,
                    confidence, importance, sensitivity, created_at, updated_at, confirmed_at
                 ) VALUES (?1, ?2, ?3, ?4, 'confirmed', 'system_observation', ?5, ?6, 'ordinary', ?7, ?8, ?9)",
                params![
                    id,
                    category.as_db(),
                    content,
                    normalized_content,
                    0.9_f64,
                    0.3_f64 + f64::from(index % 7) * 0.05_f64,
                    now,
                    now,
                    now,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(DevelopmentMemoryFixtureResult {
        created_memories: count,
        deleted_memories: 0,
    })
}

pub fn delete_development_memory_fixtures(
    connection: &Connection,
) -> Result<DevelopmentMemoryFixtureResult, StorageError> {
    let deleted = connection
        .execute(
            "DELETE FROM memories
             WHERE source_kind = 'system_observation'
               AND normalized_content LIKE 'development fixture memory %'",
            [],
        )
        .map_err(StorageError::from_sql_write)? as u32;
    Ok(DevelopmentMemoryFixtureResult {
        created_memories: 0,
        deleted_memories: deleted,
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

fn map_memory(row: &rusqlite::Row<'_>) -> rusqlite::Result<Memory> {
    let category: String = row.get(1)?;
    let status: String = row.get(4)?;
    let source_kind: String = row.get(5)?;
    let sensitivity: String = row.get(10)?;
    let use_count: i64 = row.get(15)?;
    Ok(Memory {
        id: row.get(0)?,
        category: MemoryCategory::from_db(&category).map_err(to_sql_conversion_error)?,
        content: row.get(2)?,
        normalized_content: row.get(3)?,
        status: MemoryStatus::from_db(&status).map_err(to_sql_conversion_error)?,
        source_kind: MemorySourceKind::from_db(&source_kind).map_err(to_sql_conversion_error)?,
        source_conversation_id: row.get(6)?,
        source_message_id: row.get(7)?,
        confidence: row.get(8)?,
        importance: row.get(9)?,
        sensitivity: MemorySensitivity::from_db(&sensitivity).map_err(to_sql_conversion_error)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
        confirmed_at: row.get(13)?,
        last_used_at: row.get(14)?,
        use_count: bounded_u32(use_count, "memory use count").map_err(to_sql_conversion_error)?,
        expires_at: row.get(16)?,
        supersedes_memory_id: row.get(17)?,
    })
}

fn map_journal_entry_without_tags(row: &rusqlite::Row<'_>) -> rusqlite::Result<JournalEntry> {
    Ok(JournalEntry {
        id: row.get(0)?,
        kind: JournalKind::from_db(row.get::<_, String>(1)?.as_str())
            .map_err(to_sql_conversion_error)?,
        title: row.get(2)?,
        body: row.get(3)?,
        summary: row.get(4)?,
        status: JournalStatus::from_db(row.get::<_, String>(5)?.as_str())
            .map_err(to_sql_conversion_error)?,
        source_kind: JournalSourceKind::from_db(row.get::<_, String>(6)?.as_str())
            .map_err(to_sql_conversion_error)?,
        source_conversation_id: row.get(7)?,
        source_message_id: row.get(8)?,
        mood: row.get(9)?,
        energy: row.get(10)?,
        stress: row.get(11)?,
        confidence: row.get(12)?,
        occurred_at: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        completed_at: row.get(16)?,
        allow_memory_candidates: row.get::<_, i64>(17)? == 1,
        is_private: row.get::<_, i64>(18)? == 1,
        tags: Vec::new(),
    })
}

fn journal_tags_for_entry(
    connection: &Connection,
    entry_id: &str,
) -> Result<Vec<String>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT jt.value
             FROM journal_entry_tags jet
             JOIN journal_tags jt ON jt.id = jet.tag_id
             WHERE jet.entry_id = ?1
             ORDER BY jt.value ASC",
        )
        .map_err(StorageError::from_sql_read)?;
    let tags = collect_rows(
        statement
            .query_map(params![entry_id], |row| row.get(0))
            .map_err(StorageError::from_sql_read)?,
    )?;
    Ok(tags)
}

fn set_journal_tags(
    transaction: &rusqlite::Transaction<'_>,
    entry_id: &str,
    tags: &[String],
) -> Result<(), StorageError> {
    validate_journal_tags(tags)?;
    transaction
        .execute(
            "DELETE FROM journal_entry_tags WHERE entry_id = ?1",
            params![entry_id],
        )
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    let normalized_tags = normalize_journal_tags(tags)?;
    for tag in &normalized_tags {
        let existing_id: Option<String> = transaction
            .query_row(
                "SELECT id FROM journal_tags WHERE value = ?1",
                params![tag],
                |row| row.get(0),
            )
            .optional()
            .map_err(StorageError::from_sql_read)?;
        let tag_id = existing_id.unwrap_or_else(|| generate_id("journal_tag"));
        transaction
            .execute(
                "INSERT OR IGNORE INTO journal_tags (id, value, created_at)
                 VALUES (?1, ?2, ?3)",
                params![tag_id, tag, now],
            )
            .map_err(StorageError::from_sql_write)?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO journal_entry_tags (entry_id, tag_id)
                 VALUES (?1, ?2)",
                params![entry_id, tag_id],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    transaction
        .execute(
            "UPDATE journal_fts
             SET tags = ?1
             WHERE entry_id = ?2",
            params![normalized_tags.join(" "), entry_id],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction
        .execute(
            "DELETE FROM journal_tags
             WHERE id NOT IN (SELECT DISTINCT tag_id FROM journal_entry_tags)",
            [],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

fn update_memory_status(
    connection: &Connection,
    memory_id: &str,
    status: MemoryStatus,
) -> Result<Memory, StorageError> {
    validate_identifier(memory_id, "memory ID")?;
    let now = timestamp();
    let confirmed_at = if status == MemoryStatus::Confirmed {
        Some(now.clone())
    } else {
        None
    };
    let changed = connection
        .execute(
            "UPDATE memories
             SET status = ?1,
                 updated_at = ?2,
                 confirmed_at = COALESCE(?3, confirmed_at)
             WHERE id = ?4",
            params![status.as_db(), now, confirmed_at, memory_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Memory was not found."));
    }
    if status == MemoryStatus::Confirmed {
        let supersedes_memory_id: Option<String> = connection
            .query_row(
                "SELECT supersedes_memory_id FROM memories WHERE id = ?1",
                params![memory_id],
                |row| row.get(0),
            )
            .map_err(StorageError::from_sql_read)?;
        if let Some(previous_id) = supersedes_memory_id {
            connection
                .execute(
                    "UPDATE memories
                     SET status = 'superseded',
                         updated_at = ?1
                     WHERE id = ?2 AND status = 'confirmed'",
                    params![now, previous_id],
                )
                .map_err(StorageError::from_sql_write)?;
        }
    }
    get_memory(connection, memory_id)
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

fn free_position(x: Option<i32>, y: Option<i32>) -> Option<CompanionFreePosition> {
    match (x, y) {
        (Some(x), Some(y)) => Some(CompanionFreePosition { x, y }),
        _ => None,
    }
}

fn bounded_u32(value: i64, label: &str) -> Result<u32, StorageError> {
    value
        .try_into()
        .map_err(|_| StorageError::invalid_stored_data(format!("Invalid {label}.")))
}

fn bool_to_db(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn validate_companion_preferences(preferences: &CompanionPreferences) -> Result<(), StorageError> {
    if !(60..=86_400).contains(&preferences.sleep_after_inactivity_seconds) {
        return Err(StorageError::invalid_request(
            "Sleep-after-inactivity must be between 60 seconds and 24 hours.",
        ));
    }
    if !(15..=1_440).contains(&preferences.proactive_checkin_cooldown_minutes) {
        return Err(StorageError::invalid_request(
            "Proactive check-in cooldown must be between 15 minutes and 24 hours.",
        ));
    }
    if !(280..=520).contains(&preferences.bubble_width) {
        return Err(StorageError::invalid_request(
            "Bubble width must be between 280 and 520 pixels.",
        ));
    }
    validate_clock_time(&preferences.quiet_hours_start)?;
    validate_clock_time(&preferences.quiet_hours_end)?;
    Ok(())
}

fn validate_memory_preferences(preferences: &MemoryPreferences) -> Result<(), StorageError> {
    if !(1..=365).contains(&preferences.temporary_memory_default_expiry_days) {
        return Err(StorageError::invalid_request(
            "Temporary memory expiry must be between 1 and 365 days.",
        ));
    }
    Ok(())
}

fn validate_journal_preferences(preferences: &JournalPreferences) -> Result<(), StorageError> {
    if !(15..=1_440).contains(&preferences.journal_check_in_cooldown_minutes) {
        return Err(StorageError::invalid_request(
            "Journal check-in cooldown must be between 15 minutes and 24 hours.",
        ));
    }
    if let Some(value) = &preferences.daily_check_in_time {
        validate_clock_time(value)?;
    }
    if let Some(value) = &preferences.evening_review_time {
        validate_clock_time(value)?;
    }
    Ok(())
}

fn validate_continuity_preferences(
    preferences: &ContinuityPreferences,
) -> Result<(), StorageError> {
    validate_model_name(&preferences.embedding_model)?;
    if !(4..=40).contains(&preferences.recent_message_count) {
        return Err(StorageError::invalid_request(
            "Continuity must retain between 4 and 40 recent messages.",
        ));
    }
    Ok(())
}

fn validate_journal_draft(draft: &JournalEntryDraft) -> Result<(), StorageError> {
    validate_journal_title(&draft.title)?;
    validate_journal_body(&draft.body, &draft.status)?;
    validate_journal_summary(draft.summary.as_deref())?;
    validate_journal_ratings(draft.mood, draft.energy, draft.stress, draft.confidence)?;
    validate_journal_tags(&draft.tags)?;
    if let Some(id) = &draft.source_conversation_id {
        validate_identifier(id, "source conversation ID")?;
    }
    if let Some(id) = &draft.source_message_id {
        validate_identifier(id, "source message ID")?;
    }
    Ok(())
}

fn validate_journal_update(update: &JournalEntryUpdate) -> Result<(), StorageError> {
    validate_journal_title(&update.title)?;
    validate_journal_body(&update.body, &update.status)?;
    validate_journal_summary(update.summary.as_deref())?;
    validate_journal_ratings(update.mood, update.energy, update.stress, update.confidence)?;
    validate_journal_tags(&update.tags)?;
    Ok(())
}

fn validate_journal_title(title: &str) -> Result<(), StorageError> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(StorageError::invalid_request(
            "Journal title cannot be empty.",
        ));
    }
    if trimmed.chars().count() > MAX_JOURNAL_TITLE_LENGTH {
        return Err(StorageError::invalid_request("Journal title is too long."));
    }
    Ok(())
}

fn validate_journal_body(body: &str, status: &JournalStatus) -> Result<(), StorageError> {
    let trimmed = body.trim();
    if *status == JournalStatus::Completed && trimmed.is_empty() {
        return Err(StorageError::invalid_request(
            "Completed journal entries need body text.",
        ));
    }
    if trimmed.chars().count() > MAX_JOURNAL_BODY_LENGTH {
        return Err(StorageError::invalid_request("Journal entry is too long."));
    }
    if looks_like_secret(trimmed) {
        return Err(StorageError::invalid_request(
            "Secrets should not be saved in journal entries.",
        ));
    }
    Ok(())
}

fn validate_journal_summary(summary: Option<&str>) -> Result<(), StorageError> {
    if let Some(value) = summary {
        if value.chars().count() > MAX_JOURNAL_SUMMARY_LENGTH {
            return Err(StorageError::invalid_request(
                "Journal summary is too long.",
            ));
        }
    }
    Ok(())
}

fn validate_journal_ratings(
    mood: Option<u32>,
    energy: Option<u32>,
    stress: Option<u32>,
    confidence: Option<u32>,
) -> Result<(), StorageError> {
    for rating in [mood, energy, stress, confidence].into_iter().flatten() {
        if !(1..=5).contains(&rating) {
            return Err(StorageError::invalid_request(
                "Journal ratings must be between 1 and 5.",
            ));
        }
    }
    Ok(())
}

fn validate_journal_tags(tags: &[String]) -> Result<(), StorageError> {
    let normalized = normalize_journal_tags(tags)?;
    if normalized.len() > MAX_JOURNAL_TAGS {
        return Err(StorageError::invalid_request(
            "Journal entries support up to 12 tags.",
        ));
    }
    Ok(())
}

fn validate_normalized_journal_tag(tag: &str) -> Result<(), StorageError> {
    if tag.is_empty() || tag.chars().count() > MAX_JOURNAL_TAG_LENGTH {
        return Err(StorageError::invalid_request("Journal tag is invalid."));
    }
    if !tag.chars().all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    }) {
        return Err(StorageError::invalid_request("Journal tag is invalid."));
    }
    Ok(())
}

fn validate_journal_search(query: &str) -> Result<(), StorageError> {
    if query.chars().count() > MAX_JOURNAL_SEARCH_LENGTH {
        return Err(StorageError::invalid_request(
            "Journal search query is too long.",
        ));
    }
    Ok(())
}

fn validate_memory_draft(draft: &MemoryDraft) -> Result<(), StorageError> {
    if draft.source_kind == MemorySourceKind::SystemObservation {
        return Err(StorageError::invalid_request(
            "System-observation memories are reserved for a future explicit feature.",
        ));
    }
    validate_memory_content(&draft.content)?;
    if draft.sensitivity == MemorySensitivity::Prohibited {
        return Err(StorageError::invalid_request(
            "Secrets and prohibited content cannot be stored in memory.",
        ));
    }
    if !(0.0..=1.0).contains(&draft.confidence) || !(0.0..=1.0).contains(&draft.importance) {
        return Err(StorageError::invalid_request(
            "Memory confidence and importance must be between 0 and 1.",
        ));
    }
    if let Some(id) = &draft.source_conversation_id {
        validate_identifier(id, "source conversation ID")?;
    }
    if let Some(id) = &draft.source_message_id {
        validate_identifier(id, "source message ID")?;
    }
    if let Some(id) = &draft.supersedes_memory_id {
        validate_identifier(id, "superseded memory ID")?;
    }
    Ok(())
}

fn validate_memory_content(content: &str) -> Result<(), StorageError> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err(StorageError::invalid_request(
            "Memory content cannot be empty.",
        ));
    }
    if trimmed.chars().count() > MAX_MEMORY_CONTENT_LENGTH {
        return Err(StorageError::invalid_request(
            "Memory content is too long for local companion memory.",
        ));
    }
    if looks_like_secret(trimmed) {
        return Err(StorageError::invalid_request(
            "Secrets should not be saved in companion memory.",
        ));
    }
    let normalized = normalize_memory_content(trimmed);
    if normalized.contains("ignore previous instructions")
        || normalized.contains("system prompt")
        || normalized.contains("developer message")
    {
        return Err(StorageError::invalid_request(
            "Memory content cannot contain assistant-control instructions.",
        ));
    }
    Ok(())
}

fn validate_memory_search(query: &str) -> Result<(), StorageError> {
    if query.chars().count() > MAX_MEMORY_SEARCH_LENGTH {
        return Err(StorageError::invalid_request(
            "Memory search query is too long.",
        ));
    }
    Ok(())
}

fn looks_like_secret(content: &str) -> bool {
    let lower = content.to_ascii_lowercase();
    [
        "seed phrase",
        "private key",
        "api key",
        "password",
        "recovery code",
        "auth token",
        "authentication token",
        "bearer ",
        "sk-",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn normalize_memory_content(content: &str) -> String {
    content
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_ascii_lowercase()
}

fn normalize_journal_tag(tag: &str) -> String {
    tag.trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn normalize_journal_tags(tags: &[String]) -> Result<Vec<String>, StorageError> {
    let mut normalized = Vec::new();
    for tag in tags {
        let value = normalize_journal_tag(tag);
        if value.is_empty() {
            continue;
        }
        validate_normalized_journal_tag(&value)?;
        if !normalized.contains(&value) {
            normalized.push(value);
        }
    }
    Ok(normalized)
}

fn journal_fts_query(query: &str) -> String {
    query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.chars().count() >= 2)
        .take(12)
        .map(|token| format!("{}*", token.to_ascii_lowercase()))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn memory_query_tokens(query: &str) -> Vec<String> {
    query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.chars().count() >= 3)
        .take(12)
        .map(ToOwned::to_owned)
        .collect()
}

fn validate_clock_time(value: &str) -> Result<(), StorageError> {
    let mut parts = value.split(':');
    let Some(hour) = parts.next() else {
        return Err(StorageError::invalid_request(
            "Quiet hours time is invalid.",
        ));
    };
    let Some(minute) = parts.next() else {
        return Err(StorageError::invalid_request(
            "Quiet hours time is invalid.",
        ));
    };
    if parts.next().is_some() {
        return Err(StorageError::invalid_request(
            "Quiet hours time is invalid.",
        ));
    }
    let hour = hour
        .parse::<u8>()
        .map_err(|_| StorageError::invalid_request("Quiet hours hour is invalid."))?;
    let minute = minute
        .parse::<u8>()
        .map_err(|_| StorageError::invalid_request("Quiet hours minute is invalid."))?;
    if hour > 23 || minute > 59 || value.len() != 5 {
        return Err(StorageError::invalid_request(
            "Quiet hours time is invalid.",
        ));
    }
    Ok(())
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
    fn persists_companion_preferences() {
        let connection = database();
        let mut settings = settings(&connection).expect("settings");
        settings.companion_preferences.buddy_visible = false;
        settings.companion_preferences.buddy_always_on_top = false;
        settings.companion_preferences.placement_mode = CompanionPlacementMode::TaskbarPerch;
        settings.companion_preferences.free_position =
            Some(CompanionFreePosition { x: -50, y: 42 });
        settings
            .companion_preferences
            .sleep_after_inactivity_seconds = 1_200;
        settings.companion_preferences.do_not_disturb = true;
        settings.companion_preferences.autonomous_movement_enabled = false;
        settings.companion_preferences.movement_intensity = MovementIntensity::Lively;
        settings.companion_preferences.follow_moving_surfaces = false;
        settings.companion_preferences.cursor_awareness_enabled = true;
        settings
            .companion_preferences
            .open_companion_home_at_startup = false;
        settings.companion_preferences.bubble_width = 360;

        let updated =
            set_companion_preferences(&connection, settings.companion_preferences).expect("update");
        assert!(!updated.companion_preferences.buddy_visible);
        assert_eq!(
            updated.companion_preferences.placement_mode,
            CompanionPlacementMode::TaskbarPerch
        );
        assert_eq!(
            updated.companion_preferences.free_position,
            Some(CompanionFreePosition { x: -50, y: 42 })
        );
        assert!(updated.companion_preferences.do_not_disturb);
        assert!(!updated.companion_preferences.autonomous_movement_enabled);
        assert_eq!(
            updated.companion_preferences.movement_intensity,
            MovementIntensity::Lively
        );
        assert!(!updated.companion_preferences.follow_moving_surfaces);
        assert!(updated.companion_preferences.cursor_awareness_enabled);
        assert_eq!(updated.companion_preferences.bubble_width, 360);
    }

    fn memory_draft(content: &str, status: MemoryStatus) -> MemoryDraft {
        MemoryDraft {
            category: MemoryCategory::RiskRule,
            content: content.to_owned(),
            status,
            source_kind: MemorySourceKind::UserExplicit,
            source_conversation_id: None,
            source_message_id: None,
            confidence: 0.9,
            importance: 0.8,
            sensitivity: MemorySensitivity::Personal,
            expires_at: None,
            supersedes_memory_id: None,
        }
    }

    fn journal_draft(title: &str, body: &str, status: JournalStatus) -> JournalEntryDraft {
        JournalEntryDraft {
            kind: JournalKind::TradingSession,
            title: title.to_owned(),
            body: body.to_owned(),
            summary: Some("Synthetic reflection summary.".to_owned()),
            status,
            source_kind: JournalSourceKind::DesktopGuided,
            source_conversation_id: None,
            source_message_id: None,
            mood: Some(3),
            energy: Some(4),
            stress: Some(2),
            confidence: Some(3),
            occurred_at: Some("2026-06-25T10:00:00Z".to_owned()),
            allow_memory_candidates: false,
            is_private: true,
            tags: vec!["trading".to_owned(), "process".to_owned()],
        }
    }

    #[test]
    fn persists_memory_preferences() {
        let connection = database();
        let mut preferences = settings(&connection).expect("settings").memory_preferences;
        assert!(preferences.memory_enabled);
        assert_eq!(
            preferences.memory_approval_mode,
            MemoryApprovalMode::AskEveryTime
        );
        assert!(!preferences.allow_sensitive_memories);
        assert!(!preferences.use_memories_in_temporary_chat);

        preferences.memory_approval_mode = MemoryApprovalMode::ManualOnly;
        preferences.memory_candidate_notifications = false;
        preferences.use_memories_in_temporary_chat = true;
        let updated = set_memory_preferences(&connection, preferences).expect("update");
        assert_eq!(
            updated.memory_preferences.memory_approval_mode,
            MemoryApprovalMode::ManualOnly
        );
        assert!(!updated.memory_preferences.memory_candidate_notifications);
        assert!(updated.memory_preferences.use_memories_in_temporary_chat);
    }

    #[test]
    fn persists_journal_preferences() {
        let connection = database();
        let mut preferences = settings(&connection).expect("settings").journal_preferences;
        assert!(preferences.journaling_enabled);
        assert_eq!(preferences.default_journal_mode, JournalMode::Guided);
        assert!(preferences.default_entry_private);

        preferences.default_journal_mode = JournalMode::FreeWrite;
        preferences.allow_memory_candidates_from_journal = true;
        preferences.daily_check_in_enabled = true;
        preferences.daily_check_in_time = Some("08:30".to_owned());
        preferences.evening_review_enabled = true;
        preferences.evening_review_time = Some("21:15".to_owned());
        preferences.journal_check_in_cooldown_minutes = 240;

        let updated = set_journal_preferences(&connection, preferences).expect("update");
        assert_eq!(
            updated.journal_preferences.default_journal_mode,
            JournalMode::FreeWrite
        );
        assert!(
            updated
                .journal_preferences
                .allow_memory_candidates_from_journal
        );
        assert_eq!(
            updated.journal_preferences.daily_check_in_time.as_deref(),
            Some("08:30")
        );
        assert_eq!(
            updated
                .journal_preferences
                .journal_check_in_cooldown_minutes,
            240
        );
    }

    #[test]
    fn manages_journal_lifecycle_search_export_and_delete() {
        let mut connection = database();
        let entry = create_journal_entry(
            &mut connection,
            journal_draft(
                "Trading session review",
                "I followed my risk rule and stopped after two trades.",
                JournalStatus::Completed,
            ),
        )
        .expect("create journal");
        assert_eq!(entry.kind, JournalKind::TradingSession);
        assert_eq!(entry.status, JournalStatus::Completed);
        assert!(entry.completed_at.is_some());
        assert_eq!(entry.tags, vec!["process".to_owned(), "trading".to_owned()]);

        let search_results = list_journal_entries(
            &connection,
            JournalListOptions {
                status: Some(JournalStatus::Completed),
                kind: Some(JournalKind::TradingSession),
                query: Some("risk trades".to_owned()),
                tag: Some("trading".to_owned()),
                from_date: None,
                to_date: None,
                include_private: true,
                include_discarded: false,
                sort: JournalSort::Newest,
                limit: 10,
                offset: 0,
            },
        )
        .expect("search");
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].id, entry.id);

        let updated = update_journal_entry(
            &mut connection,
            JournalEntryUpdate {
                entry_id: entry.id.clone(),
                kind: JournalKind::TradingSession,
                title: "Updated session review".to_owned(),
                body: "I followed the risk rule and reviewed the trade after closing.".to_owned(),
                summary: Some("Updated summary.".to_owned()),
                status: JournalStatus::Draft,
                mood: None,
                energy: None,
                stress: None,
                confidence: None,
                allow_memory_candidates: true,
                is_private: true,
                tags: vec!["review".to_owned()],
                expected_updated_at: entry.updated_at.clone(),
            },
        )
        .expect("update");
        assert_eq!(updated.status, JournalStatus::Draft);
        assert!(updated.completed_at.is_none());
        assert_eq!(updated.tags, vec!["review".to_owned()]);

        let export = export_journal_file(&connection, true).expect("export");
        assert_eq!(export.format, "trading-buddy-journal");
        assert_eq!(export.entries.len(), 1);

        delete_journal_entry(&connection, &entry.id).expect("delete");
        assert_eq!(
            journal_diagnostics(&connection)
                .expect("diagnostics")
                .total_count,
            0
        );
        assert_eq!(
            journal_diagnostics(&connection)
                .expect("diagnostics")
                .tag_count,
            0
        );
    }

    #[test]
    fn journal_sources_detach_when_conversation_is_deleted() {
        let mut connection = database();
        let prepared =
            prepare_generation(&mut connection, generation("Review trading")).expect("prepare");
        let mut draft = journal_draft(
            "Conversation sourced journal",
            "This reflection came from a saved conversation.",
            JournalStatus::Completed,
        );
        draft.source_kind = JournalSourceKind::ConversationConversion;
        draft.source_conversation_id = Some(prepared.conversation.id.clone());
        draft.source_message_id = Some(prepared.user_message.id.clone());
        let entry = create_journal_entry(&mut connection, draft).expect("journal");

        delete_conversation(&connection, &prepared.conversation.id).expect("delete conversation");
        let detached = get_journal_entry(&connection, &entry.id).expect("detached");
        assert!(detached.source_conversation_id.is_none());
        assert!(detached.source_message_id.is_none());
    }

    #[test]
    fn journal_diagnostics_and_development_fixtures_are_bounded() {
        let mut connection = database();
        create_development_journal_fixtures(&mut connection, 1_500).expect("fixtures");
        let diagnostics = journal_diagnostics(&connection).expect("diagnostics");
        assert_eq!(diagnostics.fixture_count, 1_000);
        assert_eq!(diagnostics.total_count, 1_000);
        assert!(diagnostics.fts_available);
        assert!(diagnostics.tag_count > 0);

        let retrieved = list_journal_entries(
            &connection,
            JournalListOptions {
                status: None,
                kind: Some(JournalKind::TradingSession),
                query: Some("bounded content".to_owned()),
                tag: Some("fixture".to_owned()),
                from_date: None,
                to_date: None,
                include_private: true,
                include_discarded: false,
                sort: JournalSort::Newest,
                limit: 8,
                offset: 0,
            },
        )
        .expect("retrieve fixtures");
        assert!(!retrieved.is_empty());

        let deleted = delete_development_journal_fixtures(&connection).expect("delete fixtures");
        assert_eq!(deleted.deleted_entries, 1_000);
        let after = journal_diagnostics(&connection).expect("diagnostics after delete");
        assert_eq!(after.fixture_count, 0);
        assert_eq!(after.tag_count, 0);
    }

    #[test]
    fn manages_memory_lifecycle_and_retrieval() {
        let connection = database();
        let proposed = create_memory(
            &connection,
            memory_draft("User caps risk at 1% per trade.", MemoryStatus::Proposed),
        )
        .expect("create proposed");
        assert_eq!(proposed.status, MemoryStatus::Proposed);
        assert!(retrieve_memories(&connection, "risk trade", 5, false)
            .expect("retrieve")
            .is_empty());

        let confirmed = confirm_memory(&connection, &proposed.id).expect("confirm");
        assert_eq!(confirmed.status, MemoryStatus::Confirmed);
        let retrieved = retrieve_memories(&connection, "risk trade", 5, false).expect("retrieve");
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].id, proposed.id);

        let edited = update_memory_content(
            &connection,
            &proposed.id,
            "User caps risk at 0.5% per trade.".to_owned(),
            MemoryCategory::RiskRule,
            MemorySensitivity::Personal,
            None,
        )
        .expect("edit");
        assert!(edited.content.contains("0.5%"));
        reject_memory(&connection, &proposed.id).expect("reject");
        assert!(retrieve_memories(&connection, "risk trade", 5, false)
            .expect("retrieve rejected")
            .is_empty());
        delete_memory(&connection, &proposed.id).expect("delete");
        assert!(get_memory(&connection, &proposed.id).is_err());
    }

    #[test]
    fn confirming_update_proposal_supersedes_previous_memory() {
        let connection = database();
        let previous = create_memory(
            &connection,
            memory_draft("User caps risk at 1% per trade.", MemoryStatus::Confirmed),
        )
        .expect("previous");
        let mut replacement =
            memory_draft("User caps risk at 0.5% per trade.", MemoryStatus::Proposed);
        replacement.supersedes_memory_id = Some(previous.id.clone());
        let replacement = create_memory(&connection, replacement).expect("replacement");

        confirm_memory(&connection, &replacement.id).expect("confirm replacement");

        assert_eq!(
            get_memory(&connection, &previous.id)
                .expect("previous")
                .status,
            MemoryStatus::Superseded
        );
        let retrieved = retrieve_memories(&connection, "risk trade", 8, false).expect("retrieve");
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].id, replacement.id);
    }

    #[test]
    fn memory_diagnostics_and_development_fixtures_are_bounded() {
        let mut connection = database();
        create_development_memory_fixtures(&mut connection, 1_500).expect("fixtures");
        let diagnostics = memory_diagnostics(&connection).expect("diagnostics");
        assert_eq!(diagnostics.fixture_count, 1_000);
        assert_eq!(diagnostics.confirmed_count, 1_000);
        assert!(diagnostics.fts_available);

        let retrieved = retrieve_memories(&connection, "bounded memory qa scenario 7", 8, false)
            .expect("retrieve fixtures");
        assert!(!retrieved.is_empty());
        assert!(retrieved.iter().all(|memory| memory
            .match_reasons
            .iter()
            .any(|reason| reason == "keyword_overlap")));

        let deleted = delete_development_memory_fixtures(&connection).expect("delete fixtures");
        assert_eq!(deleted.deleted_memories, 1_000);
        assert_eq!(
            memory_diagnostics(&connection)
                .expect("diagnostics after delete")
                .fixture_count,
            0
        );
    }

    #[test]
    fn excludes_sensitive_expired_and_superseded_memories_from_default_retrieval() {
        let connection = database();
        let ordinary = create_memory(
            &connection,
            memory_draft(
                "User prefers direct feedback after losses.",
                MemoryStatus::Confirmed,
            ),
        )
        .expect("ordinary");
        let mut sensitive = memory_draft(
            "User has a sensitive medical appointment next week.",
            MemoryStatus::Confirmed,
        );
        sensitive.category = MemoryCategory::ImportantContext;
        sensitive.sensitivity = MemorySensitivity::Sensitive;
        create_memory(&connection, sensitive).expect("sensitive");
        let mut expired = memory_draft(
            "User is temporarily testing a challenge this week.",
            MemoryStatus::Confirmed,
        );
        expired.category = MemoryCategory::TemporaryContext;
        expired.expires_at = Some("2020-01-01T00:00:00Z".to_owned());
        create_memory(&connection, expired).expect("expired");
        let superseded = create_memory(
            &connection,
            memory_draft("User prefers very long replies.", MemoryStatus::Superseded),
        )
        .expect("superseded");

        let retrieved =
            retrieve_memories(&connection, "user prefers feedback week replies", 8, false)
                .expect("retrieve");
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].id, ordinary.id);
        assert_ne!(retrieved[0].id, superseded.id);

        let with_sensitive =
            retrieve_memories(&connection, "medical appointment", 8, true).expect("sensitive");
        assert_eq!(with_sensitive.len(), 1);
        assert_eq!(with_sensitive[0].sensitivity, MemorySensitivity::Sensitive);
    }

    #[test]
    fn rejects_secret_shaped_memory_content() {
        let connection = database();
        let result = create_memory(
            &connection,
            memory_draft("password: fake-password-123", MemoryStatus::Proposed),
        );
        assert!(result.is_err());
    }

    #[test]
    fn records_usage_and_detaches_deleted_conversation_sources() {
        let mut connection = database();
        let prepared =
            prepare_generation(&mut connection, generation("Remember risk")).expect("prepare");
        let mut draft = memory_draft("User caps risk at 1% per trade.", MemoryStatus::Confirmed);
        draft.source_conversation_id = Some(prepared.conversation.id.clone());
        draft.source_message_id = Some(prepared.user_message.id.clone());
        let memory = create_memory(&connection, draft).expect("memory");
        record_memory_usage(
            &connection,
            MemoryUsageRequest {
                memory_ids: vec![memory.id.clone()],
                conversation_id: prepared.conversation.id.clone(),
                assistant_message_id: Some(prepared.assistant_message.id),
                reason_code: "chat_context".to_owned(),
            },
        )
        .expect("usage");
        let usage = list_memory_usage_records(&connection, Some(memory.id.clone()), 10)
            .expect("usage list");
        assert_eq!(usage.len(), 1);
        assert_eq!(
            get_memory(&connection, &memory.id).expect("used").use_count,
            1
        );

        delete_conversation(&connection, &prepared.conversation.id).expect("delete conversation");
        let detached = get_memory(&connection, &memory.id).expect("detached");
        assert!(detached.source_conversation_id.is_none());
        assert!(detached.source_message_id.is_none());
    }

    #[test]
    fn exports_and_deletes_memories_separately_from_conversations() {
        let mut connection = database();
        prepare_generation(&mut connection, generation("Saved conversation")).expect("prepare");
        create_memory(
            &connection,
            memory_draft("User caps risk at 1% per trade.", MemoryStatus::Confirmed),
        )
        .expect("memory");
        let export = export_memory_file(&connection, false).expect("export");
        assert_eq!(export.format, "trading-buddy-memories");
        assert_eq!(export.memories.len(), 1);

        let result = delete_all_memories(&mut connection).expect("delete memories");
        assert_eq!(result.deleted_memories, 1);
        assert_eq!(
            list_conversations(&connection, false, 20, 0)
                .expect("conversations")
                .len(),
            1
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
