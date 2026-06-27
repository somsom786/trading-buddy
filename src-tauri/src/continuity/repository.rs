use std::collections::{BTreeSet, HashMap, HashSet};

use chrono::{Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::storage::{
    errors::StorageError, models::ContinuityPreferences, repository as storage_repository,
};

use super::models::{
    ConsolidationBundle, ConsolidationJobRecord, ConsolidationSource, ContinuityRetrievalItem,
    ContinuityRetrievalResult, ContinuitySnapshot, ConversationContinuitySummary,
    ConversationSummaryRecord, CurrentLifeContextRecord, EmbeddingSource, EntityRecord, EntityType,
    EpisodeCategory, EpisodeRecord, SemanticMemoryStatus, SourceMessage,
};

const MAX_SUMMARY_ITEMS: usize = 12;
const MAX_SUMMARY_ITEM_CHARS: usize = 600;
const MAX_EPISODES_PER_JOB: usize = 3;
const MAX_ENTITIES_PER_JOB: usize = 16;
const MAX_RELATIONSHIPS_PER_JOB: usize = 16;
const MAX_CURRENT_LIFE_PER_JOB: usize = 8;
const MAX_RETRIEVAL_CANDIDATES: usize = 64;
const MAX_RETRIEVAL_RESULTS: usize = 8;

#[derive(Clone, Debug)]
pub struct RetrievalCandidate {
    pub item: ContinuityRetrievalItem,
    pub embedding: Option<Vec<f32>>,
}

pub fn recover_interrupted_jobs(connection: &Connection) -> Result<u32, StorageError> {
    let now = timestamp();
    let changed = connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = CASE WHEN attempt_count >= 3 THEN 'failed' ELSE 'pending' END,
                 last_error_code = 'application_restarted',
                 next_attempt_at = CASE WHEN attempt_count >= 3 THEN NULL ELSE ?1 END
             WHERE status = 'running'",
            params![now],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(changed as u32)
}

pub fn enqueue_conversation_job(
    connection: &Connection,
    conversation_id: &str,
) -> Result<ConsolidationJobRecord, StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    let preferences = storage_repository::settings(connection)?.continuity_preferences;
    if !preferences.consolidation_enabled {
        return Err(StorageError::invalid_request(
            "Background consolidation is disabled.",
        ));
    }
    let source_version: String = connection
        .query_row(
            "SELECT id FROM messages
             WHERE conversation_id = ?1 AND status = 'completed'
             ORDER BY created_at DESC, id DESC LIMIT 1",
            params![conversation_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?
        .ok_or_else(|| StorageError::invalid_request("Conversation has no completed messages."))?;

    if let Some(existing) =
        find_job_by_source_version(connection, conversation_id, &source_version)?
    {
        return Ok(existing);
    }
    let now = timestamp();
    connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = 'superseded', completed_at = ?1
             WHERE source_type = 'conversation' AND source_id = ?2 AND status = 'pending'",
            params![now, conversation_id],
        )
        .map_err(StorageError::from_sql_write)?;
    let id = generate_id("consolidation");
    connection
        .execute(
            "INSERT INTO consolidation_jobs (
                id, source_type, source_id, source_version, status, attempt_count,
                created_at, next_attempt_at
             ) VALUES (?1, 'conversation', ?2, ?3, 'pending', 0, ?4, ?4)",
            params![id, conversation_id, source_version, now],
        )
        .map_err(StorageError::from_sql_write)?;
    get_job(connection, &id)
}

pub fn claim_next_job(
    connection: &Connection,
) -> Result<Option<ConsolidationJobRecord>, StorageError> {
    let now = timestamp();
    let id: Option<String> = connection
        .query_row(
            "SELECT id FROM consolidation_jobs
             WHERE status = 'pending'
               AND attempt_count < 3
               AND (next_attempt_at IS NULL OR next_attempt_at <= ?1)
             ORDER BY created_at ASC, id ASC
             LIMIT 1",
            params![now],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    let Some(id) = id else {
        return Ok(None);
    };
    let changed = connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = 'running', started_at = ?1, attempt_count = attempt_count + 1,
                 last_error_code = NULL
             WHERE id = ?2 AND status = 'pending'",
            params![now, id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Ok(None);
    }
    get_job(connection, &id).map(Some)
}

pub fn load_consolidation_source(
    connection: &Connection,
    job: &ConsolidationJobRecord,
) -> Result<ConsolidationSource, StorageError> {
    if job.source_type != "conversation" {
        return Err(StorageError::invalid_request(
            "Only conversation consolidation is implemented.",
        ));
    }
    let settings = storage_repository::settings(connection)?;
    let model = settings
        .selected_local_model
        .ok_or_else(|| StorageError::invalid_request("No local conversation model is selected."))?;
    let mut statement = connection
        .prepare(
            "SELECT id, role, content, created_at
             FROM messages
             WHERE conversation_id = ?1
               AND status IN ('completed', 'interrupted')
               AND content != ''
             ORDER BY created_at ASC, id ASC
             LIMIT 200",
        )
        .map_err(StorageError::from_sql_read)?;
    let messages = statement
        .query_map(params![job.source_id], |row| {
            Ok(SourceMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(StorageError::from_sql_read)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from_sql_read)?;
    if messages.len() < 2 {
        return Err(StorageError::invalid_request(
            "A conversation needs at least two stored messages before consolidation.",
        ));
    }
    Ok(ConsolidationSource {
        conversation_id: job.source_id.clone(),
        model,
        messages,
        recent_message_count: settings.continuity_preferences.recent_message_count as usize,
    })
}

pub fn persist_consolidation_bundle(
    connection: &mut Connection,
    source: &ConsolidationSource,
    bundle: ConsolidationBundle,
) -> Result<Vec<EmbeddingSource>, StorageError> {
    validate_bundle(source, &bundle)?;
    let settings = storage_repository::settings(connection)?;
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    let summary_id = insert_summary(&transaction, source, &bundle.summary, &now)?;
    let mut embedding_sources = vec![EmbeddingSource {
        source_type: "conversation_summary".to_owned(),
        source_id: summary_id,
        content: summary_search_text(&bundle.summary),
        sensitivity: "personal".to_owned(),
    }];

    let entity_ids = upsert_entities(
        &transaction,
        source,
        &bundle,
        &settings.continuity_preferences,
        &now,
        &mut embedding_sources,
    )?;
    insert_episodes(
        &transaction,
        source,
        &bundle,
        &entity_ids,
        &settings.continuity_preferences,
        &now,
        &mut embedding_sources,
    )?;
    insert_relationships(
        &transaction,
        source,
        &bundle,
        &entity_ids,
        &settings.continuity_preferences,
        &now,
    )?;
    insert_current_life(&transaction, source, &bundle, &now, &mut embedding_sources)?;
    include_confirmed_memory_sources(&transaction, source, &mut embedding_sources)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(embedding_sources)
}

pub fn complete_job(
    connection: &Connection,
    job_id: &str,
    warning_code: Option<&str>,
) -> Result<(), StorageError> {
    let changed = connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = 'completed', completed_at = ?1, next_attempt_at = NULL,
                 last_error_code = ?2
             WHERE id = ?3 AND status = 'running'",
            params![timestamp(), warning_code, job_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Consolidation job is no longer running.",
        ));
    }
    Ok(())
}

pub fn fail_or_retry_job(
    connection: &Connection,
    job_id: &str,
    error_code: &str,
) -> Result<ConsolidationJobRecord, StorageError> {
    let job = get_job(connection, job_id)?;
    let retry = job.attempt_count < 3;
    let next_attempt = retry.then(|| {
        (Utc::now() + Duration::seconds(i64::from(job.attempt_count.max(1)) * 15)).to_rfc3339()
    });
    connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = ?1, completed_at = CASE WHEN ?1 = 'failed' THEN ?2 ELSE NULL END,
                 last_error_code = ?3, next_attempt_at = ?4
             WHERE id = ?5",
            params![
                if retry { "pending" } else { "failed" },
                timestamp(),
                truncate(error_code, 80),
                next_attempt,
                job_id,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    get_job(connection, job_id)
}

pub fn cancel_job(connection: &Connection, job_id: &str) -> Result<(), StorageError> {
    validate_identifier(job_id, "job ID")?;
    let changed = connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = 'cancelled', completed_at = ?1, next_attempt_at = NULL
             WHERE id = ?2 AND status IN ('pending', 'running')",
            params![timestamp(), job_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Only pending or running jobs can be cancelled.",
        ));
    }
    Ok(())
}

pub fn retry_job(
    connection: &Connection,
    job_id: &str,
) -> Result<ConsolidationJobRecord, StorageError> {
    validate_identifier(job_id, "job ID")?;
    let changed = connection
        .execute(
            "UPDATE consolidation_jobs
             SET status = 'pending', attempt_count = 0, started_at = NULL,
                 completed_at = NULL, last_error_code = NULL, next_attempt_at = ?1
             WHERE id = ?2 AND status IN ('failed', 'cancelled')",
            params![timestamp(), job_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Only failed or cancelled jobs can be retried.",
        ));
    }
    get_job(connection, job_id)
}

pub fn load_reembedding_sources(
    connection: &Connection,
    limit: u32,
) -> Result<Vec<EmbeddingSource>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT source_type, source_id, content, sensitivity FROM (
               SELECT 'memory' AS source_type, id AS source_id, content, sensitivity
               FROM memories WHERE status = 'confirmed'
               UNION ALL
               SELECT 'episode', id, title || ' ' || summary, sensitivity
               FROM episodes WHERE status IN ('confirmed', 'automatic_ordinary')
               UNION ALL
               SELECT 'entity', id, canonical_name, sensitivity
               FROM entities WHERE status = 'confirmed'
               UNION ALL
               SELECT 'current_life_context', id, content, sensitivity
               FROM current_life_context WHERE status = 'active'
               UNION ALL
               SELECT 'conversation_summary', id, structured_summary_json, 'personal'
               FROM conversation_summaries
             )
             ORDER BY source_type, source_id
             LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![limit.clamp(1, 512)], |row| {
            Ok(EmbeddingSource {
                source_type: row.get(0)?,
                source_id: row.get(1)?,
                content: row.get(2)?,
                sensitivity: row.get(3)?,
            })
        })
        .map_err(StorageError::from_sql_read)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from_sql_read)
}

pub fn store_embeddings(
    connection: &mut Connection,
    configured_model: &str,
    actual_model: &str,
    dimension: usize,
    sources: &[EmbeddingSource],
    vectors: &[Vec<f32>],
    preferences: &ContinuityPreferences,
) -> Result<u32, StorageError> {
    if sources.len() != vectors.len() || sources.is_empty() {
        return Err(StorageError::invalid_request(
            "Embedding source and vector counts do not match.",
        ));
    }
    if dimension == 0 || dimension > 16_384 {
        return Err(StorageError::invalid_request(
            "Embedding dimension is outside the supported range.",
        ));
    }
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let now = timestamp();
    transaction
        .execute(
            "UPDATE embedding_models SET status = 'stale', updated_at = ?1
             WHERE provider = 'ollama' AND model != ?2",
            params![now, configured_model],
        )
        .map_err(StorageError::from_sql_write)?;
    transaction
        .execute(
            "UPDATE embeddings SET stale = 1, updated_at = ?1
             WHERE embedding_model_id IN (
               SELECT id FROM embedding_models WHERE provider = 'ollama' AND model != ?2
             )",
            params![now, configured_model],
        )
        .map_err(StorageError::from_sql_write)?;
    let model_id: Option<String> = transaction
        .query_row(
            "SELECT id FROM embedding_models
             WHERE provider = 'ollama' AND model = ?1 AND dimension = ?2",
            params![configured_model, dimension as i64],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    let model_id = model_id.unwrap_or_else(|| generate_id("embedding_model"));
    transaction
        .execute(
            "INSERT INTO embedding_models (
                id, provider, model, model_digest, dimension, status, created_at, updated_at
             ) VALUES (?1, 'ollama', ?2, NULL, ?3, 'ready', ?4, ?4)
             ON CONFLICT(provider, model, dimension) DO UPDATE SET
               status = 'ready', updated_at = excluded.updated_at",
            params![model_id, configured_model, dimension as i64, now],
        )
        .map_err(StorageError::from_sql_write)?;

    let mut stored = 0u32;
    for (source, vector) in sources.iter().zip(vectors) {
        if source.sensitivity == "prohibited"
            || (source.sensitivity == "sensitive" && !preferences.embed_sensitive_content)
            || contains_secret_material(&source.content)
        {
            continue;
        }
        let blob = vector_to_blob(vector, dimension)?;
        let hash = content_hash(&source.content);
        transaction
            .execute(
                "INSERT INTO embeddings (
                    id, source_type, source_id, embedding_model_id, content_hash,
                    vector_blob, stale, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7)
                 ON CONFLICT(source_type, source_id, embedding_model_id) DO UPDATE SET
                   content_hash = excluded.content_hash,
                   vector_blob = excluded.vector_blob,
                   stale = 0,
                   updated_at = excluded.updated_at",
                params![
                    generate_id("embedding"),
                    source.source_type,
                    source.source_id,
                    model_id,
                    hash,
                    blob,
                    now,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        stored += 1;
    }
    if actual_model != configured_model {
        transaction
            .execute(
                "UPDATE embedding_models SET model_digest = ?1 WHERE id = ?2",
                params![format!("reported:{actual_model}"), model_id],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(stored)
}

pub fn mark_embedding_model_unavailable(
    connection: &Connection,
    model: &str,
    missing: bool,
) -> Result<(), StorageError> {
    let now = timestamp();
    connection
        .execute(
            "UPDATE embedding_models SET status = ?1, updated_at = ?2
             WHERE provider = 'ollama' AND model = ?3",
            params![if missing { "missing" } else { "unavailable" }, now, model],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn load_retrieval_candidates(
    connection: &Connection,
    query: &str,
    include_sensitive: bool,
    embedding_model: &str,
) -> Result<Vec<RetrievalCandidate>, StorageError> {
    let normalized_query = normalize(query);
    let tokens = query_tokens(&normalized_query);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }
    let mut candidates = Vec::new();
    load_memory_candidates(connection, &tokens, include_sensitive, &mut candidates)?;
    load_episode_candidates(connection, &tokens, include_sensitive, &mut candidates)?;
    load_entity_candidates(connection, &tokens, include_sensitive, &mut candidates)?;
    load_current_life_candidates(connection, &tokens, include_sensitive, &mut candidates)?;
    load_summary_candidates(connection, &tokens, &mut candidates)?;

    for candidate in &mut candidates {
        candidate.embedding = load_embedding(
            connection,
            &candidate.item.source_type,
            &candidate.item.source_id,
            embedding_model,
        )?;
    }
    candidates.sort_by(|left, right| {
        right
            .item
            .score
            .partial_cmp(&left.item.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.item.source_id.cmp(&right.item.source_id))
    });
    candidates.truncate(MAX_RETRIEVAL_CANDIDATES);
    Ok(candidates)
}

pub fn score_retrieval_candidates(
    mut candidates: Vec<RetrievalCandidate>,
    query_embedding: Option<&[f32]>,
    semantic_status: SemanticMemoryStatus,
    limit: u32,
) -> ContinuityRetrievalResult {
    let mut used_embedding = false;
    for candidate in &mut candidates {
        if let (Some(query), Some(vector)) = (query_embedding, candidate.embedding.as_deref()) {
            if query.len() == vector.len() {
                let similarity = cosine_similarity(query, vector);
                if similarity.is_finite() {
                    candidate.item.score += similarity * 2.5;
                    if similarity >= 0.35 {
                        candidate
                            .item
                            .reason_codes
                            .push("semantic_similarity".to_owned());
                    }
                    used_embedding = true;
                }
            }
        }
        candidate.item.reason_codes.sort();
        candidate.item.reason_codes.dedup();
    }
    candidates.retain(|candidate| {
        candidate.item.score > 0.2
            && !candidate
                .item
                .reason_codes
                .contains(&"sensitive_excluded".to_owned())
    });
    candidates.sort_by(|left, right| {
        right
            .item
            .score
            .partial_cmp(&left.item.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.item.source_type.cmp(&right.item.source_type))
            .then_with(|| left.item.source_id.cmp(&right.item.source_id))
    });
    let candidate_count = candidates.len() as u32;
    let items = candidates
        .into_iter()
        .take((limit.clamp(1, MAX_RETRIEVAL_RESULTS as u32)) as usize)
        .map(|candidate| candidate.item)
        .collect();
    ContinuityRetrievalResult {
        items,
        semantic_status,
        query_embedding_used: used_embedding,
        candidate_count,
    }
}

pub fn record_continuity_usage(
    connection: &Connection,
    conversation_id: &str,
    assistant_message_id: Option<&str>,
    items: &[ContinuityRetrievalItem],
) -> Result<(), StorageError> {
    validate_identifier(conversation_id, "conversation ID")?;
    let now = timestamp();
    for item in items.iter().take(MAX_RETRIEVAL_RESULTS) {
        connection
            .execute(
                "INSERT INTO continuity_usage_records (
                    id, source_type, source_id, conversation_id, assistant_message_id,
                    used_at, reason_codes_json, score
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    generate_id("continuity_usage"),
                    item.source_type,
                    item.source_id,
                    conversation_id,
                    assistant_message_id,
                    now,
                    serde_json::to_string(&item.reason_codes)
                        .map_err(|error| StorageError::write_failed(error.to_string()))?,
                    item.score,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        update_source_usage(connection, &item.source_type, &item.source_id, &now)?;
    }
    Ok(())
}

pub fn snapshot(connection: &Connection) -> Result<ContinuitySnapshot, StorageError> {
    let settings = storage_repository::settings(connection)?;
    let summaries = list_summaries(connection, 50)?;
    let episodes = list_episodes(connection, 100)?;
    let entities = list_entities(connection, 100)?;
    let current_life_context = list_current_life(connection, 100)?;
    let jobs = list_jobs(connection, 100)?;
    let embedding_count = count_where(connection, "embeddings", "stale = 0")?;
    let stale_embedding_count = count_where(connection, "embeddings", "stale = 1")?;
    let semantic_status = semantic_status(
        connection,
        &settings.continuity_preferences,
        stale_embedding_count,
    )?;
    Ok(ContinuitySnapshot {
        summaries,
        episodes,
        entities,
        current_life_context,
        jobs,
        semantic_status,
        embedding_model: settings.continuity_preferences.embedding_model,
        embedding_count,
        stale_embedding_count,
    })
}

pub fn update_episode(
    connection: &Connection,
    episode_id: &str,
    title: &str,
    summary: &str,
    status: &str,
) -> Result<EpisodeRecord, StorageError> {
    validate_identifier(episode_id, "episode ID")?;
    validate_bounded_text(title, "episode title", 120)?;
    validate_bounded_text(summary, "episode summary", 1_200)?;
    if !matches!(
        status,
        "proposed" | "confirmed" | "automatic_ordinary" | "rejected" | "superseded" | "deleted"
    ) {
        return Err(StorageError::invalid_request("Invalid episode status."));
    }
    if contains_secret_material(summary) {
        return Err(StorageError::invalid_request(
            "Secret-shaped content cannot be stored in continuity.",
        ));
    }
    let changed = connection
        .execute(
            "UPDATE episodes SET title = ?1, summary = ?2, status = ?3, updated_at = ?4,
             confirmed_at = CASE WHEN ?3 IN ('confirmed', 'automatic_ordinary')
               THEN COALESCE(confirmed_at, ?4) ELSE confirmed_at END
             WHERE id = ?5",
            params![
                title.trim(),
                summary.trim(),
                status,
                timestamp(),
                episode_id
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Episode was not found."));
    }
    mark_source_embedding_stale(connection, "episode", episode_id)?;
    get_episode(connection, episode_id)
}

pub fn delete_episode(connection: &Connection, episode_id: &str) -> Result<(), StorageError> {
    validate_identifier(episode_id, "episode ID")?;
    let changed = connection
        .execute(
            "UPDATE episodes
             SET title = 'Deleted episode', summary = 'Deleted by user.',
                 status = 'deleted', updated_at = ?1
             WHERE id = ?2 AND status != 'deleted'",
            params![timestamp(), episode_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Episode was not found."));
    }
    connection
        .execute(
            "DELETE FROM embeddings WHERE source_type = 'episode' AND source_id = ?1",
            params![episode_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn update_entity(
    connection: &Connection,
    entity_id: &str,
    canonical_name: &str,
    aliases: &[String],
    status: &str,
) -> Result<EntityRecord, StorageError> {
    validate_identifier(entity_id, "entity ID")?;
    validate_bounded_text(canonical_name, "entity name", 120)?;
    if !matches!(
        status,
        "proposed" | "confirmed" | "rejected" | "superseded" | "deleted"
    ) {
        return Err(StorageError::invalid_request("Invalid entity status."));
    }
    if aliases.len() > 12 {
        return Err(StorageError::invalid_request("Too many entity aliases."));
    }
    let transaction = connection
        .unchecked_transaction()
        .map_err(StorageError::from_sql_write)?;
    let changed = transaction
        .execute(
            "UPDATE entities SET canonical_name = ?1, normalized_name = ?2,
             status = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                canonical_name.trim(),
                normalize(canonical_name),
                status,
                timestamp(),
                entity_id,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Entity was not found."));
    }
    transaction
        .execute(
            "DELETE FROM entity_aliases WHERE entity_id = ?1",
            params![entity_id],
        )
        .map_err(StorageError::from_sql_write)?;
    for alias in aliases {
        validate_bounded_text(alias, "entity alias", 120)?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO entity_aliases (
                    entity_id, alias, normalized_alias, created_at
                 ) VALUES (?1, ?2, ?3, ?4)",
                params![entity_id, alias.trim(), normalize(alias), timestamp()],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    refresh_entity_fts_aliases(&transaction, entity_id)?;
    transaction.commit().map_err(StorageError::from_sql_write)?;
    mark_source_embedding_stale(connection, "entity", entity_id)?;
    get_entity(connection, entity_id)
}

pub fn delete_entity(connection: &Connection, entity_id: &str) -> Result<(), StorageError> {
    let current = get_entity(connection, entity_id)?;
    update_entity(
        connection,
        entity_id,
        &current.canonical_name,
        &current.aliases,
        "deleted",
    )?;
    connection
        .execute(
            "DELETE FROM embeddings WHERE source_type = 'entity' AND source_id = ?1",
            params![entity_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn delete_summary(connection: &Connection, summary_id: &str) -> Result<(), StorageError> {
    validate_identifier(summary_id, "summary ID")?;
    connection
        .execute(
            "DELETE FROM embeddings WHERE source_type = 'conversation_summary' AND source_id = ?1",
            params![summary_id],
        )
        .map_err(StorageError::from_sql_write)?;
    let changed = connection
        .execute(
            "DELETE FROM conversation_summaries WHERE id = ?1",
            params![summary_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request("Summary was not found."));
    }
    Ok(())
}

pub fn delete_current_life_context(
    connection: &Connection,
    context_id: &str,
) -> Result<(), StorageError> {
    validate_identifier(context_id, "current-life context ID")?;
    let changed = connection
        .execute(
            "UPDATE current_life_context
             SET status = 'deleted', updated_at = ?1 WHERE id = ?2",
            params![timestamp(), context_id],
        )
        .map_err(StorageError::from_sql_write)?;
    if changed == 0 {
        return Err(StorageError::invalid_request(
            "Current-life context was not found.",
        ));
    }
    connection
        .execute(
            "DELETE FROM embeddings
             WHERE source_type = 'current_life_context' AND source_id = ?1",
            params![context_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

pub fn delete_all_continuity(connection: &mut Connection) -> Result<u32, StorageError> {
    let transaction = connection
        .transaction()
        .map_err(StorageError::from_sql_write)?;
    let count = [
        "conversation_summaries",
        "episodes",
        "entities",
        "current_life_context",
    ]
    .into_iter()
    .try_fold(0u32, |total, table| {
        let query = format!("SELECT COUNT(*) FROM {table}");
        let count: i64 = transaction
            .query_row(&query, [], |row| row.get(0))
            .map_err(StorageError::from_sql_read)?;
        Ok::<u32, StorageError>(total.saturating_add(count.max(0) as u32))
    })?;
    for table in [
        "continuity_usage_records",
        "embeddings",
        "consolidation_jobs",
        "episode_entities",
        "episode_sources",
        "entity_relationships",
        "entity_mentions",
        "entity_aliases",
        "current_life_context",
        "entities",
        "episodes",
        "conversation_summaries",
        "embedding_models",
    ] {
        transaction
            .execute(&format!("DELETE FROM {table}"), [])
            .map_err(StorageError::from_sql_write)?;
    }
    transaction.commit().map_err(StorageError::from_sql_write)?;
    Ok(count)
}

fn insert_summary(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    summary: &ConversationContinuitySummary,
    now: &str,
) -> Result<String, StorageError> {
    let version: i64 = transaction
        .query_row(
            "SELECT COALESCE(MAX(summary_version), 0) + 1
             FROM conversation_summaries WHERE conversation_id = ?1",
            params![source.conversation_id],
            |row| row.get(0),
        )
        .map_err(StorageError::from_sql_read)?;
    let id = generate_id("conversation_summary");
    let json = serde_json::to_string(summary)
        .map_err(|error| StorageError::write_failed(error.to_string()))?;
    transaction
        .execute(
            "INSERT INTO conversation_summaries (
                id, conversation_id, summary_version, summarized_through_message_id,
                structured_summary_json, model_provider, model_name, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'ollama', ?6, ?7, ?7)",
            params![
                id,
                source.conversation_id,
                version,
                summary.summarized_through_message_id,
                json,
                source.model,
                now,
            ],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(id)
}

fn upsert_entities(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    bundle: &ConsolidationBundle,
    preferences: &ContinuityPreferences,
    now: &str,
    embeddings: &mut Vec<EmbeddingSource>,
) -> Result<HashMap<String, String>, StorageError> {
    let mut ids = HashMap::new();
    for proposed in &bundle.entities {
        if proposed.sensitivity == "prohibited" {
            continue;
        }
        let normalized_name = normalize(&proposed.canonical_name);
        let existing: Option<String> = transaction
            .query_row(
                "SELECT id FROM entities WHERE entity_type = ?1 AND normalized_name = ?2",
                params![proposed.entity_type.as_db(), normalized_name],
                |row| row.get(0),
            )
            .optional()
            .map_err(StorageError::from_sql_read)?;
        let id = existing.unwrap_or_else(|| generate_id("entity"));
        let status = if proposed.sensitivity == "ordinary"
            && preferences.automatic_ordinary_learning_enabled
        {
            "confirmed"
        } else {
            "proposed"
        };
        transaction
            .execute(
                "INSERT INTO entities (
                    id, entity_type, canonical_name, normalized_name, sensitivity, status,
                    first_mentioned_at, last_mentioned_at, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?7, ?7)
                 ON CONFLICT(entity_type, normalized_name) DO UPDATE SET
                   canonical_name = excluded.canonical_name,
                   last_mentioned_at = excluded.last_mentioned_at,
                   updated_at = excluded.updated_at,
                   status = CASE WHEN entities.status = 'deleted' THEN entities.status
                                 ELSE excluded.status END",
                params![
                    id,
                    proposed.entity_type.as_db(),
                    proposed.canonical_name.trim(),
                    normalized_name,
                    proposed.sensitivity,
                    status,
                    now,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        for alias in proposed
            .aliases
            .iter()
            .chain(std::iter::once(&proposed.canonical_name))
        {
            transaction
                .execute(
                    "INSERT OR IGNORE INTO entity_aliases (
                        entity_id, alias, normalized_alias, created_at
                     ) VALUES (?1, ?2, ?3, ?4)",
                    params![id, alias.trim(), normalize(alias), now],
                )
                .map_err(StorageError::from_sql_write)?;
        }
        for message_id in &proposed.source_message_ids {
            transaction
                .execute(
                    "INSERT OR IGNORE INTO entity_mentions (
                        entity_id, conversation_id, message_id, mentioned_at
                     ) VALUES (?1, ?2, ?3, ?4)",
                    params![id, source.conversation_id, message_id, now],
                )
                .map_err(StorageError::from_sql_write)?;
        }
        refresh_entity_fts_aliases(transaction, &id)?;
        ids.insert(normalized_name, id.clone());
        if status == "confirmed" {
            embeddings.push(EmbeddingSource {
                source_type: "entity".to_owned(),
                source_id: id,
                content: format!("{} {}", proposed.canonical_name, proposed.aliases.join(" ")),
                sensitivity: proposed.sensitivity.clone(),
            });
        }
    }
    Ok(ids)
}

fn insert_episodes(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    bundle: &ConsolidationBundle,
    entity_ids: &HashMap<String, String>,
    preferences: &ContinuityPreferences,
    now: &str,
    embeddings: &mut Vec<EmbeddingSource>,
) -> Result<(), StorageError> {
    for proposed in &bundle.episodes {
        if proposed.sensitivity == "prohibited" {
            continue;
        }
        let duplicate: Option<String> = transaction
            .query_row(
                "SELECT id FROM episodes
                 WHERE source_conversation_id = ?1
                   AND lower(title) = lower(?2)
                   AND lower(summary) = lower(?3)
                   AND status != 'deleted'
                 LIMIT 1",
                params![
                    source.conversation_id,
                    proposed.title.trim(),
                    proposed.summary.trim()
                ],
                |row| row.get(0),
            )
            .optional()
            .map_err(StorageError::from_sql_read)?;
        if duplicate.is_some() {
            continue;
        }
        let status = if proposed.sensitivity == "ordinary"
            && preferences.automatic_ordinary_learning_enabled
        {
            "automatic_ordinary"
        } else {
            "proposed"
        };
        let id = generate_id("episode");
        transaction
            .execute(
                "INSERT INTO episodes (
                    id, title, summary, category, occurred_at, importance,
                    emotional_significance, sensitivity, status, source_conversation_id,
                    created_at, updated_at, confirmed_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12)",
                params![
                    id,
                    proposed.title.trim(),
                    proposed.summary.trim(),
                    proposed.category.as_db(),
                    proposed.occurred_at,
                    proposed.importance,
                    proposed.emotional_significance,
                    proposed.sensitivity,
                    status,
                    source.conversation_id,
                    now,
                    if status == "automatic_ordinary" {
                        Some(now)
                    } else {
                        None
                    },
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        for (index, message_id) in proposed.source_message_ids.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO episode_sources (episode_id, message_id, sequence_index)
                     VALUES (?1, ?2, ?3)",
                    params![id, message_id, index as i64],
                )
                .map_err(StorageError::from_sql_write)?;
        }
        for entity_name in &proposed.entity_names {
            if let Some(entity_id) = entity_ids.get(&normalize(entity_name)) {
                transaction
                    .execute(
                        "INSERT OR IGNORE INTO episode_entities (episode_id, entity_id, role)
                         VALUES (?1, ?2, 'mentioned')",
                        params![id, entity_id],
                    )
                    .map_err(StorageError::from_sql_write)?;
            }
        }
        if status == "automatic_ordinary" {
            embeddings.push(EmbeddingSource {
                source_type: "episode".to_owned(),
                source_id: id,
                content: format!("{} {}", proposed.title, proposed.summary),
                sensitivity: proposed.sensitivity.clone(),
            });
        }
    }
    Ok(())
}

fn insert_relationships(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    bundle: &ConsolidationBundle,
    entity_ids: &HashMap<String, String>,
    preferences: &ContinuityPreferences,
    now: &str,
) -> Result<(), StorageError> {
    for relationship in &bundle.relationships {
        if relationship.sensitivity == "prohibited" {
            continue;
        }
        let subject_id = entity_ids.get(&normalize(&relationship.subject_name));
        let object_id = relationship
            .object_name
            .as_ref()
            .and_then(|name| entity_ids.get(&normalize(name)));
        if subject_id.is_none()
            || (object_id.is_none()
                && relationship
                    .object_text
                    .as_deref()
                    .map_or(true, |text| text.trim().is_empty()))
        {
            continue;
        }
        let status = if relationship.sensitivity == "ordinary"
            && preferences.automatic_ordinary_learning_enabled
        {
            "confirmed"
        } else {
            "proposed"
        };
        transaction
            .execute(
                "INSERT INTO entity_relationships (
                    id, subject_entity_id, predicate, object_entity_id, object_text,
                    sensitivity, status, source_message_id, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
                params![
                    generate_id("relationship"),
                    subject_id,
                    truncate(&relationship.predicate, 80),
                    object_id,
                    relationship
                        .object_text
                        .as_deref()
                        .map(|value| truncate(value, 300)),
                    relationship.sensitivity,
                    status,
                    relationship.source_message_id,
                    now,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
    }
    let _ = source;
    Ok(())
}

fn insert_current_life(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    bundle: &ConsolidationBundle,
    now: &str,
    embeddings: &mut Vec<EmbeddingSource>,
) -> Result<(), StorageError> {
    for current in &bundle.current_life_context {
        // Current-life records have no proposal state yet, so sensitive items cannot be
        // automatically approved merely because sensitive embedding is enabled.
        if matches!(current.sensitivity.as_str(), "prohibited" | "sensitive") {
            continue;
        }
        let normalized = normalize(&current.content);
        let duplicate: Option<String> = transaction
            .query_row(
                "SELECT id FROM current_life_context
                 WHERE normalized_content = ?1 AND status = 'active' LIMIT 1",
                params![normalized],
                |row| row.get(0),
            )
            .optional()
            .map_err(StorageError::from_sql_read)?;
        if duplicate.is_some() {
            continue;
        }
        let id = generate_id("current_life");
        transaction
            .execute(
                "INSERT INTO current_life_context (
                    id, category, content, normalized_content, status, importance,
                    sensitivity, created_at, updated_at, expires_at,
                    source_conversation_id, source_message_id
                 ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?7, ?8, ?9, ?10)",
                params![
                    id,
                    truncate(&current.category, 80),
                    current.content.trim(),
                    normalized,
                    current.importance,
                    current.sensitivity,
                    now,
                    current.expires_at,
                    source.conversation_id,
                    current.source_message_id,
                ],
            )
            .map_err(StorageError::from_sql_write)?;
        embeddings.push(EmbeddingSource {
            source_type: "current_life_context".to_owned(),
            source_id: id,
            content: current.content.clone(),
            sensitivity: current.sensitivity.clone(),
        });
    }
    Ok(())
}

fn include_confirmed_memory_sources(
    transaction: &Transaction<'_>,
    source: &ConsolidationSource,
    embeddings: &mut Vec<EmbeddingSource>,
) -> Result<(), StorageError> {
    let mut statement = transaction
        .prepare(
            "SELECT id, content, sensitivity FROM memories
             WHERE status = 'confirmed' AND source_conversation_id = ?1
             ORDER BY updated_at DESC LIMIT 16",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![source.conversation_id], |row| {
            Ok(EmbeddingSource {
                source_type: "memory".to_owned(),
                source_id: row.get(0)?,
                content: row.get(1)?,
                sensitivity: row.get(2)?,
            })
        })
        .map_err(StorageError::from_sql_read)?;
    for row in rows {
        embeddings.push(row.map_err(StorageError::from_sql_read)?);
    }
    Ok(())
}

fn validate_bundle(
    source: &ConsolidationSource,
    bundle: &ConsolidationBundle,
) -> Result<(), StorageError> {
    let message_ids: HashSet<&str> = source
        .messages
        .iter()
        .map(|message| message.id.as_str())
        .collect();
    if !message_ids.contains(bundle.summary.summarized_through_message_id.as_str()) {
        return Err(StorageError::invalid_request(
            "Summary provenance does not belong to the source conversation.",
        ));
    }
    for items in summary_arrays(&bundle.summary) {
        if items.len() > MAX_SUMMARY_ITEMS {
            return Err(StorageError::invalid_request(
                "Continuity summary contains too many items.",
            ));
        }
        for item in items {
            validate_bounded_text(item, "summary item", MAX_SUMMARY_ITEM_CHARS)?;
            if contains_secret_material(item) {
                return Err(StorageError::invalid_request(
                    "Secret-shaped content cannot be stored in continuity.",
                ));
            }
        }
    }
    if bundle.episodes.len() > MAX_EPISODES_PER_JOB
        || bundle.entities.len() > MAX_ENTITIES_PER_JOB
        || bundle.relationships.len() > MAX_RELATIONSHIPS_PER_JOB
        || bundle.current_life_context.len() > MAX_CURRENT_LIFE_PER_JOB
    {
        return Err(StorageError::invalid_request(
            "Consolidation output exceeds deterministic operation limits.",
        ));
    }
    for episode in &bundle.episodes {
        validate_bounded_text(&episode.title, "episode title", 120)?;
        validate_bounded_text(&episode.summary, "episode summary", 1_200)?;
        validate_unit_interval(episode.importance, "episode importance")?;
        validate_unit_interval(
            episode.emotional_significance,
            "episode emotional significance",
        )?;
        validate_sensitivity(&episode.sensitivity)?;
        validate_sources(&message_ids, &episode.source_message_ids, true)?;
        if contains_secret_material(&episode.summary) {
            return Err(StorageError::invalid_request(
                "Secret-shaped episode content was rejected.",
            ));
        }
    }
    for entity in &bundle.entities {
        validate_bounded_text(&entity.canonical_name, "entity name", 120)?;
        validate_sensitivity(&entity.sensitivity)?;
        validate_sources(&message_ids, &entity.source_message_ids, true)?;
        if entity.aliases.len() > 12 {
            return Err(StorageError::invalid_request("Too many entity aliases."));
        }
        for alias in &entity.aliases {
            validate_bounded_text(alias, "entity alias", 120)?;
        }
    }
    for current in &bundle.current_life_context {
        validate_bounded_text(&current.category, "current-life category", 80)?;
        validate_bounded_text(&current.content, "current-life content", 800)?;
        validate_unit_interval(current.importance, "current-life importance")?;
        validate_sensitivity(&current.sensitivity)?;
        if let Some(message_id) = &current.source_message_id {
            validate_sources(&message_ids, std::slice::from_ref(message_id), false)?;
        }
        if contains_secret_material(&current.content) {
            return Err(StorageError::invalid_request(
                "Secret-shaped current-life content was rejected.",
            ));
        }
    }
    Ok(())
}

fn summary_arrays(summary: &ConversationContinuitySummary) -> [&Vec<String>; 11] {
    [
        &summary.user_goals,
        &summary.current_topics,
        &summary.important_events,
        &summary.emotional_context,
        &summary.people_and_entities,
        &summary.projects,
        &summary.decisions,
        &summary.unresolved_items,
        &summary.promises_or_follow_ups,
        &summary.user_corrections,
        &summary.relevant_memory_ids,
    ]
}

fn validate_sources(
    allowed: &HashSet<&str>,
    supplied: &[String],
    required: bool,
) -> Result<(), StorageError> {
    if required && supplied.is_empty() {
        return Err(StorageError::invalid_request(
            "Learned records require source-message provenance.",
        ));
    }
    if supplied.iter().any(|id| !allowed.contains(id.as_str())) {
        return Err(StorageError::invalid_request(
            "Learned record provenance does not belong to the conversation.",
        ));
    }
    Ok(())
}

fn summary_search_text(summary: &ConversationContinuitySummary) -> String {
    summary_arrays(summary)
        .into_iter()
        .flat_map(|items| items.iter())
        .cloned()
        .collect::<Vec<_>>()
        .join(" ")
}

fn load_memory_candidates(
    connection: &Connection,
    tokens: &[String],
    include_sensitive: bool,
    output: &mut Vec<RetrievalCandidate>,
) -> Result<(), StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, content, normalized_content, sensitivity, importance,
                    source_conversation_id, source_message_id, last_used_at
             FROM memories
             WHERE status = 'confirmed'
               AND (expires_at IS NULL OR expires_at > ?1)
               AND (?2 = 1 OR sensitivity != 'sensitive')
             ORDER BY importance DESC, updated_at DESC LIMIT 32",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![timestamp(), bool_db(include_sensitive)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;
    for row in rows {
        let (
            id,
            content,
            normalized,
            sensitivity,
            importance,
            conversation_id,
            message_id,
            last_used,
        ) = row.map_err(StorageError::from_sql_read)?;
        let (score, reasons) = lexical_score(&normalized, tokens, importance);
        if score > 0.0 || output.len() < 8 {
            output.push(RetrievalCandidate {
                item: ContinuityRetrievalItem {
                    source_type: "memory".to_owned(),
                    source_id: id,
                    title: "Confirmed memory".to_owned(),
                    content: content.clone(),
                    sensitivity,
                    score,
                    reason_codes: reasons,
                    source_conversation_id: conversation_id,
                    source_message_ids: message_id.into_iter().collect(),
                    last_used_at: last_used,
                },
                embedding: None,
            });
        }
    }
    Ok(())
}

fn load_episode_candidates(
    connection: &Connection,
    tokens: &[String],
    include_sensitive: bool,
    output: &mut Vec<RetrievalCandidate>,
) -> Result<(), StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, summary, sensitivity, importance,
                    source_conversation_id, last_used_at, pinned
             FROM episodes
             WHERE status IN ('confirmed', 'automatic_ordinary')
               AND (?1 = 1 OR sensitivity != 'sensitive')
             ORDER BY pinned DESC, importance DESC, updated_at DESC LIMIT 32",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![bool_db(include_sensitive)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;
    for row in rows {
        let (id, title, summary, sensitivity, importance, conversation_id, last_used, pinned) =
            row.map_err(StorageError::from_sql_read)?;
        let text = format!("{title} {summary}");
        let (mut score, mut reasons) = lexical_score(&normalize(&text), tokens, importance);
        reasons.push("recent_episode".to_owned());
        score += 0.15;
        if pinned == 1 {
            reasons.push("pinned".to_owned());
            score += 0.5;
        }
        output.push(RetrievalCandidate {
            item: ContinuityRetrievalItem {
                source_type: "episode".to_owned(),
                source_id: id.clone(),
                title,
                content: summary,
                sensitivity,
                score,
                reason_codes: reasons,
                source_conversation_id: conversation_id,
                source_message_ids: episode_source_ids(connection, &id)?,
                last_used_at: last_used,
            },
            embedding: None,
        });
    }
    Ok(())
}

fn load_entity_candidates(
    connection: &Connection,
    tokens: &[String],
    include_sensitive: bool,
    output: &mut Vec<RetrievalCandidate>,
) -> Result<(), StorageError> {
    for entity in list_entities(connection, 64)? {
        if entity.status != "confirmed" || (!include_sensitive && entity.sensitivity == "sensitive")
        {
            continue;
        }
        let text = format!("{} {}", entity.canonical_name, entity.aliases.join(" "));
        let (mut score, mut reasons) = lexical_score(&normalize(&text), tokens, 0.5);
        if score > 0.0 {
            reasons.push(if entity.entity_type == EntityType::Project {
                "project_match".to_owned()
            } else {
                "entity_match".to_owned()
            });
            score += 0.8;
        }
        output.push(RetrievalCandidate {
            item: ContinuityRetrievalItem {
                source_type: "entity".to_owned(),
                source_id: entity.id,
                title: format!("{:?}", entity.entity_type).to_lowercase(),
                content: text.clone(),
                sensitivity: entity.sensitivity,
                score,
                reason_codes: reasons,
                source_conversation_id: None,
                source_message_ids: Vec::new(),
                last_used_at: entity.last_used_at,
            },
            embedding: None,
        });
    }
    Ok(())
}

fn load_current_life_candidates(
    connection: &Connection,
    tokens: &[String],
    include_sensitive: bool,
    output: &mut Vec<RetrievalCandidate>,
) -> Result<(), StorageError> {
    for context in list_current_life(connection, 32)? {
        if context.status != "active"
            || context
                .expires_at
                .as_ref()
                .is_some_and(|expires| expires <= &timestamp())
            || (!include_sensitive && context.sensitivity == "sensitive")
        {
            continue;
        }
        let (mut score, mut reasons) =
            lexical_score(&normalize(&context.content), tokens, context.importance);
        reasons.push("current_life_context".to_owned());
        score += 0.25;
        output.push(RetrievalCandidate {
            item: ContinuityRetrievalItem {
                source_type: "current_life_context".to_owned(),
                source_id: context.id,
                title: context.category,
                content: context.content.clone(),
                sensitivity: context.sensitivity,
                score,
                reason_codes: reasons,
                source_conversation_id: context.source_conversation_id,
                source_message_ids: context.source_message_id.into_iter().collect(),
                last_used_at: context.last_used_at,
            },
            embedding: None,
        });
    }
    Ok(())
}

fn load_summary_candidates(
    connection: &Connection,
    tokens: &[String],
    output: &mut Vec<RetrievalCandidate>,
) -> Result<(), StorageError> {
    for summary in list_summaries(connection, 24)? {
        let text = summary_search_text(&summary.summary);
        let (mut score, mut reasons) = lexical_score(&normalize(&text), tokens, 0.5);
        reasons.push("conversation_summary".to_owned());
        score += 0.1;
        output.push(RetrievalCandidate {
            item: ContinuityRetrievalItem {
                source_type: "conversation_summary".to_owned(),
                source_id: summary.id,
                title: "Conversation continuity summary".to_owned(),
                content: text.clone(),
                sensitivity: "personal".to_owned(),
                score,
                reason_codes: reasons,
                source_conversation_id: Some(summary.conversation_id),
                source_message_ids: vec![summary.summarized_through_message_id],
                last_used_at: None,
            },
            embedding: None,
        });
    }
    Ok(())
}

fn lexical_score(text: &str, tokens: &[String], importance: f64) -> (f64, Vec<String>) {
    let overlap = tokens
        .iter()
        .filter(|token| text.contains(token.as_str()))
        .count();
    let mut reasons = Vec::new();
    if overlap > 0 {
        reasons.push("keyword_overlap".to_owned());
    }
    let joined = tokens.join(" ");
    if !joined.is_empty() && text.contains(&joined) {
        reasons.push("exact_phrase".to_owned());
    }
    if importance >= 0.75 {
        reasons.push("high_importance".to_owned());
    }
    (overlap as f64 + importance * 0.4, reasons)
}

fn load_embedding(
    connection: &Connection,
    source_type: &str,
    source_id: &str,
    model: &str,
) -> Result<Option<Vec<f32>>, StorageError> {
    let row: Option<(Vec<u8>, i64)> = connection
        .query_row(
            "SELECT e.vector_blob, m.dimension
             FROM embeddings e
             JOIN embedding_models m ON m.id = e.embedding_model_id
             WHERE e.source_type = ?1 AND e.source_id = ?2
               AND e.stale = 0 AND m.provider = 'ollama' AND m.model = ?3
               AND m.status = 'ready'
             ORDER BY e.updated_at DESC LIMIT 1",
            params![source_type, source_id, model],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    row.map(|(blob, dimension)| blob_to_vector(&blob, dimension as usize))
        .transpose()
}

fn vector_to_blob(vector: &[f32], dimension: usize) -> Result<Vec<u8>, StorageError> {
    if vector.len() != dimension || vector.iter().any(|value| !value.is_finite()) {
        return Err(StorageError::invalid_request(
            "Embedding vector has an invalid dimension or value.",
        ));
    }
    let mut blob = Vec::with_capacity(dimension * 4);
    for value in vector {
        blob.extend_from_slice(&value.to_le_bytes());
    }
    Ok(blob)
}

pub fn blob_to_vector(blob: &[u8], dimension: usize) -> Result<Vec<f32>, StorageError> {
    if dimension == 0 || blob.len() != dimension.saturating_mul(4) {
        return Err(StorageError::invalid_stored_data(
            "Embedding BLOB length does not match its dimension.",
        ));
    }
    let mut vector = Vec::with_capacity(dimension);
    for chunk in blob.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(StorageError::invalid_stored_data(
                "Embedding BLOB contains a non-finite value.",
            ));
        }
        vector.push(value);
    }
    Ok(vector)
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f64 {
    if left.len() != right.len() || left.is_empty() {
        return 0.0;
    }
    left.iter()
        .zip(right)
        .map(|(a, b)| f64::from(*a) * f64::from(*b))
        .sum()
}

fn content_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    format!("{digest:x}")
}

fn list_summaries(
    connection: &Connection,
    limit: u32,
) -> Result<Vec<ConversationSummaryRecord>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, conversation_id, summary_version, summarized_through_message_id,
                    structured_summary_json, model_provider, model_name, created_at, updated_at
             FROM conversation_summaries
             ORDER BY updated_at DESC, id ASC LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![limit.clamp(1, 100)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;
    rows.map(|row| {
        let (id, conversation_id, version, through, json, provider, model, created, updated) =
            row.map_err(StorageError::from_sql_read)?;
        let summary = serde_json::from_str(&json)
            .map_err(|error| StorageError::invalid_stored_data(error.to_string()))?;
        Ok(ConversationSummaryRecord {
            id,
            conversation_id,
            summary_version: version.max(0) as u32,
            summarized_through_message_id: through,
            summary,
            model_provider: provider,
            model_name: model,
            created_at: created,
            updated_at: updated,
        })
    })
    .collect()
}

fn list_episodes(connection: &Connection, limit: u32) -> Result<Vec<EpisodeRecord>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, summary, category, occurred_at, importance,
                    emotional_significance, sensitivity, status, source_conversation_id,
                    pinned, created_at, updated_at, last_used_at, use_count
             FROM episodes WHERE status != 'deleted'
             ORDER BY pinned DESC, updated_at DESC, id ASC LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![limit.clamp(1, 100)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, i64>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, Option<String>>(13)?,
                row.get::<_, i64>(14)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;
    rows.map(|row| {
        let (
            id,
            title,
            summary,
            category,
            occurred_at,
            importance,
            emotional_significance,
            sensitivity,
            status,
            conversation_id,
            pinned,
            created,
            updated,
            last_used,
            use_count,
        ) = row.map_err(StorageError::from_sql_read)?;
        Ok(EpisodeRecord {
            source_message_ids: episode_source_ids(connection, &id)?,
            entity_ids: episode_entity_ids(connection, &id)?,
            id,
            title,
            summary,
            category: EpisodeCategory::from_db(&category).unwrap_or(EpisodeCategory::Other),
            occurred_at,
            importance,
            emotional_significance,
            sensitivity,
            status,
            source_conversation_id: conversation_id,
            pinned: pinned == 1,
            created_at: created,
            updated_at: updated,
            last_used_at: last_used,
            use_count: use_count.max(0) as u32,
        })
    })
    .collect()
}

fn list_entities(connection: &Connection, limit: u32) -> Result<Vec<EntityRecord>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, entity_type, canonical_name, normalized_name, sensitivity, status,
                    pinned, first_mentioned_at, last_mentioned_at, created_at, updated_at,
                    last_used_at, use_count
             FROM entities WHERE status != 'deleted'
             ORDER BY pinned DESC, last_mentioned_at DESC, id ASC LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let rows = statement
        .query_map(params![limit.clamp(1, 100)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, i64>(12)?,
            ))
        })
        .map_err(StorageError::from_sql_read)?;
    rows.map(|row| {
        let (
            id,
            entity_type,
            canonical,
            normalized,
            sensitivity,
            status,
            pinned,
            first,
            last,
            created,
            updated,
            last_used,
            use_count,
        ) = row.map_err(StorageError::from_sql_read)?;
        Ok(EntityRecord {
            aliases: entity_aliases(connection, &id)?,
            id,
            entity_type: EntityType::from_db(&entity_type).unwrap_or(EntityType::Other),
            canonical_name: canonical,
            normalized_name: normalized,
            sensitivity,
            status,
            pinned: pinned == 1,
            first_mentioned_at: first,
            last_mentioned_at: last,
            created_at: created,
            updated_at: updated,
            last_used_at: last_used,
            use_count: use_count.max(0) as u32,
        })
    })
    .collect()
}

fn list_current_life(
    connection: &Connection,
    limit: u32,
) -> Result<Vec<CurrentLifeContextRecord>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, category, content, status, importance, sensitivity, pinned,
                    created_at, updated_at, expires_at, source_conversation_id,
                    source_message_id, last_used_at, use_count
             FROM current_life_context WHERE status != 'deleted'
             ORDER BY pinned DESC, importance DESC, updated_at DESC LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let result = statement
        .query_map(params![limit.clamp(1, 100)], |row| {
            Ok(CurrentLifeContextRecord {
                id: row.get(0)?,
                category: row.get(1)?,
                content: row.get(2)?,
                status: row.get(3)?,
                importance: row.get(4)?,
                sensitivity: row.get(5)?,
                pinned: row.get::<_, i64>(6)? == 1,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                expires_at: row.get(9)?,
                source_conversation_id: row.get(10)?,
                source_message_id: row.get(11)?,
                last_used_at: row.get(12)?,
                use_count: row.get::<_, i64>(13)?.max(0) as u32,
            })
        })
        .map_err(StorageError::from_sql_read)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from_sql_read);
    result
}

fn list_jobs(
    connection: &Connection,
    limit: u32,
) -> Result<Vec<ConsolidationJobRecord>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT id, source_type, source_id, source_version, status, attempt_count,
                    created_at, started_at, completed_at, last_error_code, next_attempt_at
             FROM consolidation_jobs ORDER BY created_at DESC, id ASC LIMIT ?1",
        )
        .map_err(StorageError::from_sql_read)?;
    let result = statement
        .query_map(params![limit.clamp(1, 100)], map_job)
        .map_err(StorageError::from_sql_read)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from_sql_read);
    result
}

fn get_job(connection: &Connection, job_id: &str) -> Result<ConsolidationJobRecord, StorageError> {
    connection
        .query_row(
            "SELECT id, source_type, source_id, source_version, status, attempt_count,
                    created_at, started_at, completed_at, last_error_code, next_attempt_at
             FROM consolidation_jobs WHERE id = ?1",
            params![job_id],
            map_job,
        )
        .map_err(StorageError::from_sql_read)
}

pub fn get_job_for_command(
    connection: &Connection,
    job_id: &str,
) -> Result<ConsolidationJobRecord, StorageError> {
    get_job(connection, job_id)
}

fn find_job_by_source_version(
    connection: &Connection,
    source_id: &str,
    version: &str,
) -> Result<Option<ConsolidationJobRecord>, StorageError> {
    connection
        .query_row(
            "SELECT id, source_type, source_id, source_version, status, attempt_count,
                    created_at, started_at, completed_at, last_error_code, next_attempt_at
             FROM consolidation_jobs
             WHERE source_type = 'conversation' AND source_id = ?1 AND source_version = ?2",
            params![source_id, version],
            map_job,
        )
        .optional()
        .map_err(StorageError::from_sql_read)
}

fn map_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<ConsolidationJobRecord> {
    Ok(ConsolidationJobRecord {
        id: row.get(0)?,
        source_type: row.get(1)?,
        source_id: row.get(2)?,
        source_version: row.get(3)?,
        status: row.get(4)?,
        attempt_count: row.get::<_, i64>(5)?.max(0) as u32,
        created_at: row.get(6)?,
        started_at: row.get(7)?,
        completed_at: row.get(8)?,
        last_error_code: row.get(9)?,
        next_attempt_at: row.get(10)?,
    })
}

fn get_episode(connection: &Connection, episode_id: &str) -> Result<EpisodeRecord, StorageError> {
    list_episodes(connection, 100)?
        .into_iter()
        .find(|episode| episode.id == episode_id)
        .ok_or_else(|| StorageError::invalid_request("Episode was not found."))
}

fn get_entity(connection: &Connection, entity_id: &str) -> Result<EntityRecord, StorageError> {
    list_entities(connection, 100)?
        .into_iter()
        .find(|entity| entity.id == entity_id)
        .ok_or_else(|| StorageError::invalid_request("Entity was not found."))
}

fn entity_aliases(connection: &Connection, entity_id: &str) -> Result<Vec<String>, StorageError> {
    let mut statement = connection
        .prepare(
            "SELECT alias FROM entity_aliases WHERE entity_id = ?1 ORDER BY normalized_alias ASC",
        )
        .map_err(StorageError::from_sql_read)?;
    let result = statement
        .query_map(params![entity_id], |row| row.get(0))
        .map_err(StorageError::from_sql_read)?
        .collect::<Result<Vec<String>, _>>()
        .map_err(StorageError::from_sql_read);
    result
}

fn episode_source_ids(
    connection: &Connection,
    episode_id: &str,
) -> Result<Vec<String>, StorageError> {
    list_ids(
        connection,
        "SELECT message_id FROM episode_sources
         WHERE episode_id = ?1 ORDER BY sequence_index ASC, message_id ASC",
        episode_id,
    )
}

fn episode_entity_ids(
    connection: &Connection,
    episode_id: &str,
) -> Result<Vec<String>, StorageError> {
    list_ids(
        connection,
        "SELECT entity_id FROM episode_entities
         WHERE episode_id = ?1 ORDER BY entity_id ASC",
        episode_id,
    )
}

fn list_ids(connection: &Connection, query: &str, id: &str) -> Result<Vec<String>, StorageError> {
    let mut statement = connection
        .prepare(query)
        .map_err(StorageError::from_sql_read)?;
    let result = statement
        .query_map(params![id], |row| row.get(0))
        .map_err(StorageError::from_sql_read)?
        .collect::<Result<Vec<String>, _>>()
        .map_err(StorageError::from_sql_read);
    result
}

fn refresh_entity_fts_aliases(
    connection: &Connection,
    entity_id: &str,
) -> Result<(), StorageError> {
    let aliases = entity_aliases(connection, entity_id)?.join(" ");
    connection
        .execute(
            "UPDATE entity_fts SET aliases = ?1 WHERE entity_id = ?2",
            params![aliases, entity_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

fn semantic_status(
    connection: &Connection,
    preferences: &ContinuityPreferences,
    stale_count: u32,
) -> Result<SemanticMemoryStatus, StorageError> {
    if !preferences.semantic_memory_enabled {
        return Ok(SemanticMemoryStatus::LexicalMemoryMode);
    }
    if stale_count > 0 {
        return Ok(SemanticMemoryStatus::ReembeddingRequired);
    }
    let status: Option<String> = connection
        .query_row(
            "SELECT status FROM embedding_models
             WHERE provider = 'ollama' AND model = ?1
             ORDER BY updated_at DESC LIMIT 1",
            params![preferences.embedding_model],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from_sql_read)?;
    Ok(match status.as_deref() {
        Some("ready") => SemanticMemoryStatus::Ready,
        Some("unavailable") => SemanticMemoryStatus::EmbeddingModelUnavailable,
        Some("stale") => SemanticMemoryStatus::ReembeddingRequired,
        _ => SemanticMemoryStatus::EmbeddingModelMissing,
    })
}

fn update_source_usage(
    connection: &Connection,
    source_type: &str,
    source_id: &str,
    now: &str,
) -> Result<(), StorageError> {
    let table = match source_type {
        "memory" => "memories",
        "episode" => "episodes",
        "entity" => "entities",
        "current_life_context" => "current_life_context",
        "conversation_summary" => return Ok(()),
        _ => {
            return Err(StorageError::invalid_request(
                "Invalid continuity source type.",
            ))
        }
    };
    connection
        .execute(
            &format!(
                "UPDATE {table} SET last_used_at = ?1, use_count = use_count + 1 WHERE id = ?2"
            ),
            params![now, source_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

fn mark_source_embedding_stale(
    connection: &Connection,
    source_type: &str,
    source_id: &str,
) -> Result<(), StorageError> {
    connection
        .execute(
            "UPDATE embeddings SET stale = 1, updated_at = ?1
             WHERE source_type = ?2 AND source_id = ?3",
            params![timestamp(), source_type, source_id],
        )
        .map_err(StorageError::from_sql_write)?;
    Ok(())
}

fn count_where(connection: &Connection, table: &str, predicate: &str) -> Result<u32, StorageError> {
    let query = format!("SELECT COUNT(*) FROM {table} WHERE {predicate}");
    let count: i64 = connection
        .query_row(&query, [], |row| row.get(0))
        .map_err(StorageError::from_sql_read)?;
    Ok(count.max(0) as u32)
}

fn query_tokens(query: &str) -> Vec<String> {
    let stopwords: HashSet<&str> = [
        "about", "that", "this", "what", "when", "where", "which", "with", "your", "from", "were",
        "was", "still", "have", "been", "into", "would", "could",
    ]
    .into_iter()
    .collect();
    query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.chars().count() >= 2 && !stopwords.contains(token))
        .map(ToOwned::to_owned)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .take(16)
        .collect()
}

fn normalize(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn validate_bounded_text(value: &str, label: &str, max: usize) -> Result<(), StorageError> {
    let length = value.trim().chars().count();
    if length == 0 || length > max {
        return Err(StorageError::invalid_request(format!(
            "{label} must contain between 1 and {max} characters."
        )));
    }
    Ok(())
}

fn validate_unit_interval(value: f64, label: &str) -> Result<(), StorageError> {
    if !value.is_finite() || !(0.0..=1.0).contains(&value) {
        return Err(StorageError::invalid_request(format!(
            "{label} must be between 0 and 1."
        )));
    }
    Ok(())
}

fn validate_sensitivity(value: &str) -> Result<(), StorageError> {
    if matches!(value, "ordinary" | "personal" | "sensitive" | "prohibited") {
        Ok(())
    } else {
        Err(StorageError::invalid_request(
            "Invalid continuity sensitivity.",
        ))
    }
}

fn contains_secret_material(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    [
        "seed phrase",
        "private key",
        "recovery phrase",
        "mnemonic",
        "api_key=",
        "api key:",
        "password:",
        "secret:",
    ]
    .iter()
    .any(|pattern| normalized.contains(pattern))
        || value
            .split_whitespace()
            .any(|token| token.starts_with("0x") && token.len() >= 64)
}

fn validate_identifier(value: &str, label: &str) -> Result<(), StorageError> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_:.".contains(character))
    {
        Ok(())
    } else {
        Err(StorageError::invalid_request(format!("Invalid {label}.")))
    }
}

fn truncate(value: &str, max: usize) -> String {
    value.chars().take(max).collect()
}

fn bool_db(value: bool) -> i64 {
    i64::from(value)
}

fn generate_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

fn timestamp() -> String {
    Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};
    use tempfile::tempdir;

    use super::{
        blob_to_vector, claim_next_job, delete_episode, enqueue_conversation_job,
        load_retrieval_candidates, recover_interrupted_jobs, score_retrieval_candidates,
        store_embeddings, update_episode, RetrievalCandidate,
    };
    use crate::{
        continuity::models::{ContinuityRetrievalItem, EmbeddingSource, SemanticMemoryStatus},
        storage::migrations::{configure_connection, run_migrations},
    };

    fn database() -> Connection {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        connection
    }

    #[test]
    fn validates_little_endian_vector_blob_length_and_values() {
        let values = [0.25f32, -0.5f32];
        let blob = values
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect::<Vec<_>>();
        assert_eq!(blob_to_vector(&blob, 2).expect("vector"), values);
        assert!(blob_to_vector(&blob[..4], 2).is_err());
        let nan_blob = f32::NAN.to_le_bytes();
        assert!(blob_to_vector(&nan_blob, 1).is_err());
    }

    #[test]
    fn semantic_scoring_is_bounded_and_deterministic() {
        let candidate = |id: &str, vector: Vec<f32>| RetrievalCandidate {
            item: ContinuityRetrievalItem {
                source_type: "episode".to_owned(),
                source_id: id.to_owned(),
                title: id.to_owned(),
                content: "FarmTown beta concern".to_owned(),
                sensitivity: "ordinary".to_owned(),
                score: 0.5,
                reason_codes: vec!["recent_episode".to_owned()],
                source_conversation_id: None,
                source_message_ids: Vec::new(),
                last_used_at: None,
            },
            embedding: Some(vector),
        };
        let result = score_retrieval_candidates(
            vec![
                candidate("b", vec![0.0, 1.0]),
                candidate("a", vec![1.0, 0.0]),
            ],
            Some(&[1.0, 0.0]),
            SemanticMemoryStatus::Ready,
            1,
        );
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].source_id, "a");
        assert!(result.items[0]
            .reason_codes
            .contains(&"semantic_similarity".to_owned()));
    }

    #[test]
    fn migration_keeps_continuity_foreign_keys_enabled() {
        let connection = database();
        let enabled: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .expect("foreign keys");
        assert_eq!(enabled, 1);
    }

    #[test]
    fn farmtown_semantic_recall_survives_restart_then_honors_correction_and_deletion() {
        let directory = tempdir().expect("temp directory");
        let path = directory.path().join("continuity.sqlite3");
        let mut connection = Connection::open(&path).expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        let now = "2026-06-27T18:00:00Z";
        connection
            .execute(
                "INSERT INTO conversations (id, title, created_at, updated_at)
                 VALUES ('conversation-farmtown', 'FarmTown', ?1, ?1)",
                params![now],
            )
            .expect("conversation");
        connection
            .execute(
                "INSERT INTO messages (
                    id, conversation_id, role, content, status, created_at, updated_at, completed_at
                 ) VALUES (
                    'message-farmtown', 'conversation-farmtown', 'user',
                    'FarmTown is a crypto farming project. Beta user acquisition is unresolved.',
                    'completed', ?1, ?1, ?1
                 )",
                params![now],
            )
            .expect("message");
        connection
            .execute(
                "INSERT INTO episodes (
                    id, title, summary, category, importance, emotional_significance,
                    sensitivity, status, source_conversation_id, created_at, updated_at,
                    confirmed_at
                 ) VALUES (
                    'episode-farmtown', 'FarmTown beta',
                    'FarmTown is a crypto farming project; beta user acquisition remains unresolved.',
                    'project', 0.9, 0.7, 'ordinary', 'automatic_ordinary',
                    'conversation-farmtown', ?1, ?1, ?1
                 )",
                params![now],
            )
            .expect("episode");
        connection
            .execute(
                "INSERT INTO episode_sources (episode_id, message_id, sequence_index)
                 VALUES ('episode-farmtown', 'message-farmtown', 0)",
                [],
            )
            .expect("source");
        let preferences = crate::storage::repository::settings(&connection)
            .expect("settings")
            .continuity_preferences;
        store_embeddings(
            &mut connection,
            "embeddinggemma:300m",
            "embeddinggemma:300m",
            2,
            &[EmbeddingSource {
                source_type: "episode".to_owned(),
                source_id: "episode-farmtown".to_owned(),
                content: "FarmTown crypto farming project beta user acquisition remains unresolved"
                    .to_owned(),
                sensitivity: "ordinary".to_owned(),
            }],
            &[vec![1.0, 0.0]],
            &preferences,
        )
        .expect("embedding");
        drop(connection);

        let reopened = Connection::open(&path).expect("reopen");
        configure_connection(&reopened).expect("reconfigure");
        let candidates = load_retrieval_candidates(
            &reopened,
            "What was I nervous about with that farming game?",
            false,
            "embeddinggemma:300m",
        )
        .expect("restart candidates");
        let recalled = score_retrieval_candidates(
            candidates,
            Some(&[1.0, 0.0]),
            SemanticMemoryStatus::Ready,
            8,
        );
        assert!(recalled.query_embedding_used);
        let episode = recalled
            .items
            .iter()
            .find(|item| item.source_id == "episode-farmtown")
            .expect("semantic FarmTown episode");
        assert!(episode
            .content
            .contains("user acquisition remains unresolved"));
        assert!(episode
            .reason_codes
            .contains(&"semantic_similarity".to_owned()));

        update_episode(
            &reopened,
            "episode-farmtown",
            "FarmTown beta correction",
            "The unresolved concern is onboarding conversion, not beta user acquisition.",
            "confirmed",
        )
        .expect("correction");
        let corrected_candidates = load_retrieval_candidates(
            &reopened,
            "What was unresolved about onboarding conversion?",
            false,
            "embeddinggemma:300m",
        )
        .expect("corrected candidates");
        let corrected = score_retrieval_candidates(
            corrected_candidates,
            None,
            SemanticMemoryStatus::ReembeddingRequired,
            8,
        );
        assert!(corrected.items.iter().any(|item| {
            item.source_id == "episode-farmtown" && item.content.contains("onboarding conversion")
        }));

        delete_episode(&reopened, "episode-farmtown").expect("delete");
        let deleted = load_retrieval_candidates(
            &reopened,
            "FarmTown onboarding conversion",
            false,
            "embeddinggemma:300m",
        )
        .expect("post-delete candidates");
        assert!(!deleted
            .iter()
            .any(|candidate| candidate.item.source_id == "episode-farmtown"));
    }

    #[test]
    fn consolidation_jobs_coalesce_and_recover_after_restart() {
        let connection = database();
        let now = "2026-06-27T18:00:00Z";
        connection
            .execute(
                "INSERT INTO conversations (id, title, created_at, updated_at)
                 VALUES ('conversation-job', 'Job recovery', ?1, ?1)",
                params![now],
            )
            .expect("conversation");
        connection
            .execute(
                "INSERT INTO messages (
                    id, conversation_id, role, content, status, created_at, updated_at, completed_at
                 ) VALUES (
                    'message-job', 'conversation-job', 'user', 'Meaningful local conversation.',
                    'completed', ?1, ?1, ?1
                 )",
                params![now],
            )
            .expect("message");

        let first = enqueue_conversation_job(&connection, "conversation-job").expect("enqueue");
        let duplicate =
            enqueue_conversation_job(&connection, "conversation-job").expect("coalesced enqueue");
        assert_eq!(first.id, duplicate.id);

        let running = claim_next_job(&connection)
            .expect("claim")
            .expect("running job");
        assert_eq!(running.status, "running");
        assert_eq!(recover_interrupted_jobs(&connection).expect("recover"), 1);
        let status: String = connection
            .query_row(
                "SELECT status FROM consolidation_jobs WHERE id = ?1",
                params![running.id],
                |row| row.get(0),
            )
            .expect("job status");
        assert_eq!(status, "pending");
    }
}
