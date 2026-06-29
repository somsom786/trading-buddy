pub mod models;
pub mod repository;

use std::time::Duration;

use tauri::State;

use crate::{
    local_ai::{
        errors::{LocalAiError, LocalAiErrorCode},
        models::{ChatRole, ProviderMessage},
        LocalAiService,
    },
    storage::{errors::StorageError, models::ContinuityPreferences, StorageService},
};

use self::{
    models::{
        ConsolidationBundle, ConsolidationJobRecord, ContinuityRetrievalItem,
        ContinuityRetrievalResult, ContinuitySnapshot, EpisodeRecord, SemanticMemoryStatus,
    },
    repository::{
        cancel_job, claim_next_job, complete_job, delete_all_continuity,
        delete_current_life_context, delete_entity, delete_episode, delete_summary,
        enqueue_conversation_job, fail_or_retry_job, load_consolidation_source,
        load_reembedding_sources, load_retrieval_candidates, make_job_ready,
        mark_embedding_model_unavailable, persist_consolidation_bundle, record_continuity_usage,
        retry_job, score_retrieval_candidates, snapshot, store_embeddings, update_entity,
        update_episode,
    },
};

pub async fn run_worker_loop(storage: StorageService, local_ai: LocalAiService) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;
        let _ = process_next_job(storage.clone(), local_ai.clone()).await;
    }
}

pub async fn process_next_job(
    storage: StorageService,
    local_ai: LocalAiService,
) -> Result<Option<ConsolidationJobRecord>, StorageError> {
    let job = storage
        .run(|connection, _| claim_next_job(connection))
        .await?;
    let Some(job) = job else {
        return Ok(None);
    };
    let source = match storage
        .run({
            let job = job.clone();
            move |connection, _| load_consolidation_source(connection, &job)
        })
        .await
    {
        Ok(source) => source,
        Err(error) => {
            let code = error_code(&error);
            return storage
                .run({
                    let job_id = job.id.clone();
                    move |connection, _| fail_or_retry_job(connection, &job_id, &code)
                })
                .await
                .map(Some);
        }
    };

    let schema = consolidation_schema();
    let response = local_ai
        .structured_chat_with_schema(&source.model, &consolidation_messages(&source), &schema)
        .await;
    let raw = match response {
        Ok(raw) => raw,
        Err(error) => {
            let code = local_ai_error_code(&error);
            return storage
                .run({
                    let job_id = job.id.clone();
                    move |connection, _| fail_or_retry_job(connection, &job_id, &code)
                })
                .await
                .map(Some);
        }
    };
    let bundle = match parse_consolidation_bundle(&raw) {
        Ok(bundle) => bundle,
        Err(_first_error) => {
            #[cfg(debug_assertions)]
            eprintln!("continuity consolidation output failed validation: {_first_error}");
            let repaired = local_ai
                .structured_chat_with_schema(
                    &source.model,
                    &repair_consolidation_messages(&source, &raw),
                    &schema,
                )
                .await;
            match repaired {
                Ok(repaired) => match parse_consolidation_bundle(&repaired) {
                    Ok(bundle) => bundle,
                    Err(_) => {
                        return storage
                            .run({
                                let job_id = job.id.clone();
                                move |connection, _| {
                                    fail_or_retry_job(connection, &job_id, "invalid_model_output")
                                }
                            })
                            .await
                            .map(Some);
                    }
                },
                Err(_) => {
                    return storage
                        .run({
                            let job_id = job.id.clone();
                            move |connection, _| {
                                fail_or_retry_job(connection, &job_id, "invalid_model_output")
                            }
                        })
                        .await
                        .map(Some);
                }
            }
        }
    };
    let embedding_sources = match storage
        .run({
            let source = source.clone();
            move |connection, _| persist_consolidation_bundle(connection, &source, bundle)
        })
        .await
    {
        Ok(sources) => sources,
        Err(error) => {
            let code = error_code(&error);
            return storage
                .run({
                    let job_id = job.id.clone();
                    move |connection, _| fail_or_retry_job(connection, &job_id, &code)
                })
                .await
                .map(Some);
        }
    };

    let preferences = storage
        .run(|connection, _| {
            Ok(crate::storage::repository::settings(connection)?.continuity_preferences)
        })
        .await?;
    let embedding_warning = if preferences.semantic_memory_enabled {
        embed_sources(storage.clone(), local_ai, &preferences, embedding_sources)
            .await
            .err()
            .map(|error| local_ai_error_code(&error))
    } else {
        None
    };
    storage
        .run({
            let job_id = job.id.clone();
            move |connection, _| complete_job(connection, &job_id, embedding_warning.as_deref())
        })
        .await?;
    storage
        .run({
            let job_id = job.id;
            move |connection, _| repository::get_job_for_command(connection, &job_id)
        })
        .await
        .map(Some)
}

async fn embed_sources(
    storage: StorageService,
    local_ai: LocalAiService,
    preferences: &ContinuityPreferences,
    sources: Vec<models::EmbeddingSource>,
) -> Result<u32, LocalAiError> {
    let mut stored = 0u32;
    for chunk in sources.chunks(16) {
        let inputs = chunk
            .iter()
            .map(|source| source.content.clone())
            .collect::<Vec<_>>();
        let result = match local_ai.embed(&preferences.embedding_model, &inputs).await {
            Ok(result) => result,
            Err(error) => {
                let missing = error.code == LocalAiErrorCode::SelectedModelUnavailable;
                let model = preferences.embedding_model.clone();
                let _ = storage
                    .run(move |connection, _| {
                        mark_embedding_model_unavailable(connection, &model, missing)
                    })
                    .await;
                return Err(error);
            }
        };
        let chunk = chunk.to_vec();
        let configured_model = preferences.embedding_model.clone();
        let actual_model = result.model.clone();
        let dimension = result.dimension;
        let vectors = result.vectors;
        let preferences = preferences.clone();
        stored = stored.saturating_add(
            storage
                .run(move |connection, _| {
                    store_embeddings(
                        connection,
                        &configured_model,
                        &actual_model,
                        dimension,
                        &chunk,
                        &vectors,
                        &preferences,
                    )
                })
                .await
                .map_err(|error| LocalAiError::internal_with_detail(error.to_string()))?,
        );
    }
    Ok(stored)
}

#[tauri::command]
pub async fn enqueue_continuity_consolidation(
    conversation_id: String,
    storage: State<'_, StorageService>,
) -> Result<ConsolidationJobRecord, StorageError> {
    storage
        .run(move |connection, _| enqueue_conversation_job(connection, &conversation_id))
        .await
}

#[tauri::command]
pub async fn consolidate_continuity_now(
    conversation_id: String,
    storage: State<'_, StorageService>,
    local_ai: State<'_, LocalAiService>,
) -> Result<Option<ConsolidationJobRecord>, StorageError> {
    let job = storage
        .run(move |connection, _| enqueue_conversation_job(connection, &conversation_id))
        .await?;
    storage
        .run(move |connection, _| make_job_ready(connection, &job.id))
        .await?;
    process_next_job(storage.inner().clone(), local_ai.inner().clone()).await
}

#[tauri::command]
pub async fn get_continuity_snapshot(
    storage: State<'_, StorageService>,
) -> Result<ContinuitySnapshot, StorageError> {
    storage.run(|connection, _| snapshot(connection)).await
}

#[tauri::command]
pub async fn retrieve_continuity(
    query: String,
    limit: u32,
    include_sensitive: bool,
    storage: State<'_, StorageService>,
    local_ai: State<'_, LocalAiService>,
) -> Result<ContinuityRetrievalResult, StorageError> {
    validate_query(&query)?;
    let preferences = storage
        .run(|connection, _| {
            Ok(crate::storage::repository::settings(connection)?.continuity_preferences)
        })
        .await?;
    let candidates = storage
        .run({
            let query = query.clone();
            let model = preferences.embedding_model.clone();
            move |connection, _| {
                load_retrieval_candidates(connection, &query, include_sensitive, &model)
            }
        })
        .await?;
    if !preferences.semantic_memory_enabled {
        return Ok(score_retrieval_candidates(
            candidates,
            None,
            SemanticMemoryStatus::LexicalMemoryMode,
            limit,
        ));
    }
    let embedded = local_ai
        .embed(&preferences.embedding_model, std::slice::from_ref(&query))
        .await;
    match embedded {
        Ok(result) => Ok(score_retrieval_candidates(
            candidates,
            result.vectors.first().map(Vec::as_slice),
            SemanticMemoryStatus::Ready,
            limit,
        )),
        Err(error) => {
            let status = if error.code == LocalAiErrorCode::SelectedModelUnavailable {
                SemanticMemoryStatus::EmbeddingModelMissing
            } else {
                SemanticMemoryStatus::EmbeddingModelUnavailable
            };
            let missing = status == SemanticMemoryStatus::EmbeddingModelMissing;
            let model = preferences.embedding_model;
            storage
                .run(move |connection, _| {
                    mark_embedding_model_unavailable(connection, &model, missing)
                })
                .await?;
            Ok(score_retrieval_candidates(candidates, None, status, limit))
        }
    }
}

#[tauri::command]
pub async fn record_continuity_retrieval_usage(
    conversation_id: String,
    assistant_message_id: Option<String>,
    items: Vec<ContinuityRetrievalItem>,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| {
            record_continuity_usage(
                connection,
                &conversation_id,
                assistant_message_id.as_deref(),
                &items,
            )
        })
        .await
}

#[tauri::command]
pub async fn update_continuity_episode(
    episode_id: String,
    title: String,
    summary: String,
    status: String,
    storage: State<'_, StorageService>,
) -> Result<EpisodeRecord, StorageError> {
    storage
        .run(move |connection, _| {
            update_episode(connection, &episode_id, &title, &summary, &status)
        })
        .await
}

#[tauri::command]
pub async fn delete_continuity_episode(
    episode_id: String,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| delete_episode(connection, &episode_id))
        .await
}

#[tauri::command]
pub async fn update_continuity_entity(
    entity_id: String,
    canonical_name: String,
    aliases: Vec<String>,
    status: String,
    storage: State<'_, StorageService>,
) -> Result<models::EntityRecord, StorageError> {
    storage
        .run(move |connection, _| {
            update_entity(connection, &entity_id, &canonical_name, &aliases, &status)
        })
        .await
}

#[tauri::command]
pub async fn delete_continuity_entity(
    entity_id: String,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| delete_entity(connection, &entity_id))
        .await
}

#[tauri::command]
pub async fn delete_continuity_summary(
    summary_id: String,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| delete_summary(connection, &summary_id))
        .await
}

#[tauri::command]
pub async fn delete_current_life_item(
    context_id: String,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| delete_current_life_context(connection, &context_id))
        .await
}

#[tauri::command]
pub async fn cancel_continuity_job(
    job_id: String,
    storage: State<'_, StorageService>,
) -> Result<(), StorageError> {
    storage
        .run(move |connection, _| cancel_job(connection, &job_id))
        .await
}

#[tauri::command]
pub async fn retry_continuity_job(
    job_id: String,
    storage: State<'_, StorageService>,
    local_ai: State<'_, LocalAiService>,
) -> Result<ConsolidationJobRecord, StorageError> {
    let job = storage
        .run(move |connection, _| retry_job(connection, &job_id))
        .await?;
    let worker_storage = storage.inner().clone();
    let worker_ai = local_ai.inner().clone();
    tauri::async_runtime::spawn(async move {
        let _ = process_next_job(worker_storage, worker_ai).await;
    });
    Ok(job)
}

#[tauri::command]
pub async fn reembed_continuity(
    storage: State<'_, StorageService>,
    local_ai: State<'_, LocalAiService>,
) -> Result<u32, StorageError> {
    let preferences = storage
        .run(|connection, _| {
            Ok(crate::storage::repository::settings(connection)?.continuity_preferences)
        })
        .await?;
    if !preferences.semantic_memory_enabled {
        return Err(StorageError::invalid_request(
            "Semantic retrieval is disabled.",
        ));
    }
    let sources = storage
        .run(|connection, _| load_reembedding_sources(connection, 512))
        .await?;
    if sources.is_empty() {
        return Ok(0);
    }
    embed_sources(
        storage.inner().clone(),
        local_ai.inner().clone(),
        &preferences,
        sources,
    )
    .await
    .map_err(|error| StorageError::write_failed(error.to_string()))
}

#[tauri::command]
pub async fn delete_all_continuity_data(
    storage: State<'_, StorageService>,
) -> Result<u32, StorageError> {
    storage
        .run(|connection, _| delete_all_continuity(connection))
        .await
}

fn parse_consolidation_bundle(raw: &str) -> Result<ConsolidationBundle, serde_json::Error> {
    let trimmed = raw.trim();
    match serde_json::from_str(trimmed) {
        Ok(bundle) => Ok(bundle),
        Err(direct_error) => {
            let Some(start) = trimmed.find('{') else {
                return Err(direct_error);
            };
            let Some(end) = trimmed.rfind('}') else {
                return Err(direct_error);
            };
            serde_json::from_str(&trimmed[start..=end])
        }
    }
}

fn consolidation_schema() -> serde_json::Value {
    let string_array = || serde_json::json!({"type": "array", "items": {"type": "string"}});
    let sensitivity = serde_json::json!({
        "type": "string",
        "enum": ["ordinary", "personal", "sensitive", "prohibited"]
    });
    serde_json::json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["summary", "episodes", "entities", "relationships", "currentLifeContext"],
        "properties": {
            "summary": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "userGoals", "currentTopics", "importantEvents", "emotionalContext",
                    "peopleAndEntities", "projects", "decisions", "unresolvedItems",
                    "promisesOrFollowUps", "userCorrections", "relevantMemoryIds",
                    "summarizedThroughMessageId"
                ],
                "properties": {
                    "userGoals": string_array(),
                    "currentTopics": string_array(),
                    "importantEvents": string_array(),
                    "emotionalContext": string_array(),
                    "peopleAndEntities": string_array(),
                    "projects": string_array(),
                    "decisions": string_array(),
                    "unresolvedItems": string_array(),
                    "promisesOrFollowUps": string_array(),
                    "userCorrections": string_array(),
                    "relevantMemoryIds": string_array(),
                    "summarizedThroughMessageId": {"type": "string"}
                }
            },
            "episodes": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "title", "summary", "category", "occurredAt", "importance",
                        "emotionalSignificance", "sensitivity", "sourceMessageIds", "entityNames"
                    ],
                    "properties": {
                        "title": {"type": "string"},
                        "summary": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": [
                                "life_event", "emotional_moment", "project", "decision",
                                "achievement", "setback", "shared_activity", "conversation", "other"
                            ]
                        },
                        "occurredAt": {"type": ["string", "null"]},
                        "importance": {"type": "number", "minimum": 0, "maximum": 1},
                        "emotionalSignificance": {
                            "type": "number", "minimum": 0, "maximum": 1
                        },
                        "sensitivity": sensitivity.clone(),
                        "sourceMessageIds": string_array(),
                        "entityNames": string_array()
                    }
                }
            },
            "entities": {
                "type": "array",
                "maxItems": 16,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "entityType", "canonicalName", "aliases", "sensitivity",
                        "sourceMessageIds"
                    ],
                    "properties": {
                        "entityType": {
                            "type": "string",
                            "enum": [
                                "person", "pet", "project", "company", "community", "place",
                                "product", "goal", "idea", "other"
                            ]
                        },
                        "canonicalName": {"type": "string"},
                        "aliases": string_array(),
                        "sensitivity": sensitivity.clone(),
                        "sourceMessageIds": string_array()
                    }
                }
            },
            "relationships": {
                "type": "array",
                "maxItems": 16,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "subjectName", "predicate", "objectName", "objectText", "sensitivity",
                        "sourceMessageId"
                    ],
                    "properties": {
                        "subjectName": {"type": "string"},
                        "predicate": {"type": "string"},
                        "objectName": {"type": ["string", "null"]},
                        "objectText": {"type": ["string", "null"]},
                        "sensitivity": sensitivity.clone(),
                        "sourceMessageId": {"type": ["string", "null"]}
                    }
                }
            },
            "currentLifeContext": {
                "type": "array",
                "maxItems": 8,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "category", "content", "importance", "sensitivity", "expiresAt",
                        "sourceMessageId"
                    ],
                    "properties": {
                        "category": {"type": "string"},
                        "content": {"type": "string"},
                        "importance": {"type": "number", "minimum": 0, "maximum": 1},
                        "sensitivity": sensitivity,
                        "expiresAt": {"type": ["string", "null"]},
                        "sourceMessageId": {"type": ["string", "null"]}
                    }
                }
            }
        }
    })
}

fn repair_consolidation_messages(
    source: &models::ConsolidationSource,
    candidate: &str,
) -> Vec<ProviderMessage> {
    let through_index = source
        .messages
        .len()
        .saturating_sub(source.recent_message_count)
        .saturating_sub(1);
    let through_id = &source.messages[through_index].id;
    let allowed_ids = source
        .messages
        .iter()
        .map(|message| message.id.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let candidate = candidate.chars().take(12_000).collect::<String>();
    let system = r#"You repair a local continuity candidate into a strict JSON transport object.
Return only one JSON object. Do not invent facts, outcomes, provenance, or hidden reasoning.
Discard unsupported fields. Use empty arrays when the candidate does not support a field."#;
    let user = format!(
        r#"CANDIDATE
{candidate}
END CANDIDATE

Allowed sourceMessageIds: {allowed_ids}

Return exactly this camelCase shape:
{{
  "summary": {{
    "userGoals": [], "currentTopics": [], "importantEvents": [], "emotionalContext": [],
    "peopleAndEntities": [], "projects": [], "decisions": [], "unresolvedItems": [],
    "promisesOrFollowUps": [], "userCorrections": [], "relevantMemoryIds": [],
    "summarizedThroughMessageId": "{through_id}"
  }},
  "episodes": [],
  "entities": [],
  "relationships": [],
  "currentLifeContext": []
}}

Preserve supported candidate facts in the appropriate arrays. Episodes and entities require
sourceMessageIds from the allowed list; omit them if the candidate does not provide valid
provenance. summarizedThroughMessageId must be exactly "{through_id}". The first character must be
{{ and the last character must be }}. No Markdown or commentary."#
    );
    vec![
        ProviderMessage {
            role: ChatRole::System,
            content: system.to_owned(),
        },
        ProviderMessage {
            role: ChatRole::User,
            content: user,
        },
    ]
}

fn consolidation_messages(source: &models::ConsolidationSource) -> Vec<ProviderMessage> {
    let through_index = source
        .messages
        .len()
        .saturating_sub(source.recent_message_count)
        .saturating_sub(1);
    let through_id = &source.messages[through_index].id;
    let transcript = bounded_transcript(&source.messages, 60_000);
    let system = r#"You extract local companion continuity from a supplied transcript.
Return only JSON. Do not include hidden reasoning, diagnosis, inferred motives, secrets, credentials,
or unsupported outcomes. Preserve uncertainty and unresolved decisions. Every episode and entity
must cite sourceMessageIds copied exactly from the transcript. Produce no more than 3 episodes,
16 entities, 16 relationships, and 8 currentLifeContext items. Sensitivity must be ordinary,
personal, sensitive, or prohibited. Prohibited items must not be stored."#;
    let user = format!(
        r#"Create this exact camelCase JSON object:
{{
  "summary": {{
    "userGoals": [], "currentTopics": [], "importantEvents": [], "emotionalContext": [],
    "peopleAndEntities": [], "projects": [], "decisions": [], "unresolvedItems": [],
    "promisesOrFollowUps": [], "userCorrections": [], "relevantMemoryIds": [],
    "summarizedThroughMessageId": "{through_id}"
  }},
  "episodes": [{{"title":"","summary":"","category":"project","occurredAt":null,
    "importance":0.5,"emotionalSignificance":0.5,"sensitivity":"ordinary",
    "sourceMessageIds":[],"entityNames":[]}}],
  "entities": [{{"entityType":"project","canonicalName":"","aliases":[],
    "sensitivity":"ordinary","sourceMessageIds":[]}}],
  "relationships": [{{"subjectName":"","predicate":"","objectName":null,"objectText":null,
    "sensitivity":"ordinary","sourceMessageId":null}}],
  "currentLifeContext": [{{"category":"unresolved_decision","content":"","importance":0.5,
    "sensitivity":"ordinary","expiresAt":null,"sourceMessageId":null}}]
}}

summarizedThroughMessageId MUST be exactly "{through_id}".
Use empty arrays when nothing is supported.

TRANSCRIPT
{transcript}
END TRANSCRIPT

OUTPUT REQUIREMENTS
Return exactly one JSON object using the schema above. The first character must be {{ and the last
character must be }}. Do not answer the transcript, continue its conversation, or include Markdown,
commentary, or reasoning. summarizedThroughMessageId must be exactly "{through_id}"."#
    );
    vec![
        ProviderMessage {
            role: ChatRole::System,
            content: system.to_owned(),
        },
        ProviderMessage {
            role: ChatRole::User,
            content: user,
        },
    ]
}

fn bounded_transcript(messages: &[models::SourceMessage], max_chars: usize) -> String {
    let mut output = String::new();
    for message in messages {
        let content = message
            .content
            .replace(['\r', '\n'], " ")
            .chars()
            .take(4_000)
            .collect::<String>();
        let line = format!(
            "[id={} role={} at={}] {}\n",
            message.id, message.role, message.created_at, content
        );
        if output.chars().count().saturating_add(line.chars().count()) > max_chars {
            break;
        }
        output.push_str(&line);
    }
    output
}

fn validate_query(query: &str) -> Result<(), StorageError> {
    let length = query.trim().chars().count();
    if length == 0 || length > 500 {
        return Err(StorageError::invalid_request(
            "Continuity query must contain between 1 and 500 characters.",
        ));
    }
    let lower = query.to_ascii_lowercase();
    if ["seed phrase", "private key", "recovery phrase", "password:"]
        .iter()
        .any(|pattern| lower.contains(pattern))
    {
        return Err(StorageError::invalid_request(
            "Secret-shaped content cannot be used for semantic memory.",
        ));
    }
    Ok(())
}

fn local_ai_error_code(error: &LocalAiError) -> String {
    match error.code {
        LocalAiErrorCode::OllamaNotRunning => "ollama_not_running",
        LocalAiErrorCode::NoModelsInstalled => "no_models_installed",
        LocalAiErrorCode::SelectedModelUnavailable => "selected_model_unavailable",
        LocalAiErrorCode::ConnectionTimeout => "connection_timeout",
        LocalAiErrorCode::RequestCancelled => "request_cancelled",
        LocalAiErrorCode::MalformedOllamaResponse => "malformed_ollama_response",
        LocalAiErrorCode::GenerationFailed => "generation_failed",
        LocalAiErrorCode::InvalidFrontendRequest => "generation_priority_or_invalid_request",
        LocalAiErrorCode::InternalApplicationError => "internal_application_error",
    }
    .to_owned()
}

fn error_code(error: &StorageError) -> String {
    serde_json::to_value(&error.code)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "storage_error".to_owned())
}

#[cfg(test)]
mod tests {
    use super::{consolidation_schema, parse_consolidation_bundle};

    const MINIMAL_BUNDLE: &str = r#"{
      "summary": {
        "summarizedThroughMessageId": "message-1"
      }
    }"#;

    #[test]
    fn parses_a_direct_consolidation_object() {
        let bundle = parse_consolidation_bundle(MINIMAL_BUNDLE).expect("valid bundle");

        assert_eq!(bundle.summary.summarized_through_message_id, "message-1");
    }

    #[test]
    fn parses_one_strict_object_from_a_markdown_wrapper() {
        let wrapped = format!("Here is the JSON:\n```json\n{MINIMAL_BUNDLE}\n```");

        let bundle = parse_consolidation_bundle(&wrapped).expect("wrapped bundle");

        assert_eq!(bundle.summary.summarized_through_message_id, "message-1");
    }

    #[test]
    fn rejects_wrapped_json_with_an_invalid_schema() {
        let invalid = "```json\n{\"summary\":{\"summarizedThroughMessageId\":42}}\n```";

        assert!(parse_consolidation_bundle(invalid).is_err());
    }

    #[test]
    fn structured_output_schema_requires_all_continuity_sections() {
        let schema = consolidation_schema();
        let required = schema["required"].as_array().expect("required fields");

        for field in [
            "summary",
            "episodes",
            "entities",
            "relationships",
            "currentLifeContext",
        ] {
            assert!(required.iter().any(|value| value == field));
        }
        assert_eq!(schema["additionalProperties"], false);
    }
}
