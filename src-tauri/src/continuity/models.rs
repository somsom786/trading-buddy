use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationContinuitySummary {
    #[serde(default)]
    pub user_goals: Vec<String>,
    #[serde(default)]
    pub current_topics: Vec<String>,
    #[serde(default)]
    pub important_events: Vec<String>,
    #[serde(default)]
    pub emotional_context: Vec<String>,
    #[serde(default)]
    pub people_and_entities: Vec<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub decisions: Vec<String>,
    #[serde(default)]
    pub unresolved_items: Vec<String>,
    #[serde(default)]
    pub promises_or_follow_ups: Vec<String>,
    #[serde(default)]
    pub user_corrections: Vec<String>,
    #[serde(default)]
    pub relevant_memory_ids: Vec<String>,
    pub summarized_through_message_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EpisodeCategory {
    LifeEvent,
    EmotionalMoment,
    Project,
    Decision,
    Achievement,
    Setback,
    SharedActivity,
    Conversation,
    Other,
}

impl EpisodeCategory {
    pub fn as_db(&self) -> &'static str {
        match self {
            Self::LifeEvent => "life_event",
            Self::EmotionalMoment => "emotional_moment",
            Self::Project => "project",
            Self::Decision => "decision",
            Self::Achievement => "achievement",
            Self::Setback => "setback",
            Self::SharedActivity => "shared_activity",
            Self::Conversation => "conversation",
            Self::Other => "other",
        }
    }

    pub fn from_db(value: &str) -> Option<Self> {
        Some(match value {
            "life_event" => Self::LifeEvent,
            "emotional_moment" => Self::EmotionalMoment,
            "project" => Self::Project,
            "decision" => Self::Decision,
            "achievement" => Self::Achievement,
            "setback" => Self::Setback,
            "shared_activity" => Self::SharedActivity,
            "conversation" => Self::Conversation,
            "other" => Self::Other,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    Person,
    Pet,
    Project,
    Company,
    Community,
    Place,
    Product,
    Goal,
    Idea,
    Other,
}

impl EntityType {
    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Person => "person",
            Self::Pet => "pet",
            Self::Project => "project",
            Self::Company => "company",
            Self::Community => "community",
            Self::Place => "place",
            Self::Product => "product",
            Self::Goal => "goal",
            Self::Idea => "idea",
            Self::Other => "other",
        }
    }

    pub fn from_db(value: &str) -> Option<Self> {
        Some(match value {
            "person" => Self::Person,
            "pet" => Self::Pet,
            "project" => Self::Project,
            "company" => Self::Company,
            "community" => Self::Community,
            "place" => Self::Place,
            "product" => Self::Product,
            "goal" => Self::Goal,
            "idea" => Self::Idea,
            "other" => Self::Other,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedEpisode {
    pub title: String,
    pub summary: String,
    pub category: EpisodeCategory,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<String>,
    pub importance: f64,
    pub emotional_significance: f64,
    pub sensitivity: String,
    #[serde(default)]
    pub source_message_ids: Vec<String>,
    #[serde(default)]
    pub entity_names: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedEntity {
    pub entity_type: EntityType,
    pub canonical_name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub sensitivity: String,
    #[serde(default)]
    pub source_message_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedRelationship {
    pub subject_name: String,
    pub predicate: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object_name: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object_text: Option<String>,
    pub sensitivity: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedCurrentLifeContext {
    pub category: String,
    pub content: String,
    pub importance: f64,
    pub sensitivity: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationBundle {
    pub summary: ConversationContinuitySummary,
    #[serde(default)]
    pub episodes: Vec<ProposedEpisode>,
    #[serde(default)]
    pub entities: Vec<ProposedEntity>,
    #[serde(default)]
    pub relationships: Vec<ProposedRelationship>,
    #[serde(default)]
    pub current_life_context: Vec<ProposedCurrentLifeContext>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummaryRecord {
    pub id: String,
    pub conversation_id: String,
    pub summary_version: u32,
    pub summarized_through_message_id: String,
    pub summary: ConversationContinuitySummary,
    pub model_provider: String,
    pub model_name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeRecord {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub category: EpisodeCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<String>,
    pub importance: f64,
    pub emotional_significance: f64,
    pub sensitivity: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub use_count: u32,
    pub source_message_ids: Vec<String>,
    pub entity_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntityRecord {
    pub id: String,
    pub entity_type: EntityType,
    pub canonical_name: String,
    pub normalized_name: String,
    pub aliases: Vec<String>,
    pub sensitivity: String,
    pub status: String,
    pub pinned: bool,
    pub first_mentioned_at: String,
    pub last_mentioned_at: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub use_count: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CurrentLifeContextRecord {
    pub id: String,
    pub category: String,
    pub content: String,
    pub status: String,
    pub importance: f64,
    pub sensitivity: String,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    pub use_count: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationJobRecord {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub source_version: String,
    pub status: String,
    pub attempt_count: u32,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_attempt_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SemanticMemoryStatus {
    Ready,
    EmbeddingModelMissing,
    EmbeddingModelUnavailable,
    LexicalMemoryMode,
    ReembeddingRequired,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityRetrievalItem {
    pub source_type: String,
    pub source_id: String,
    pub title: String,
    pub content: String,
    pub sensitivity: String,
    pub score: f64,
    pub reason_codes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_conversation_id: Option<String>,
    pub source_message_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityRetrievalResult {
    pub items: Vec<ContinuityRetrievalItem>,
    pub semantic_status: SemanticMemoryStatus,
    pub query_embedding_used: bool,
    pub candidate_count: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContinuitySnapshot {
    pub summaries: Vec<ConversationSummaryRecord>,
    pub episodes: Vec<EpisodeRecord>,
    pub entities: Vec<EntityRecord>,
    pub current_life_context: Vec<CurrentLifeContextRecord>,
    pub jobs: Vec<ConsolidationJobRecord>,
    pub semantic_status: SemanticMemoryStatus,
    pub embedding_model: String,
    pub embedding_count: u32,
    pub stale_embedding_count: u32,
}

#[derive(Clone, Debug)]
pub struct ConsolidationSource {
    pub conversation_id: String,
    pub model: String,
    pub messages: Vec<SourceMessage>,
    pub recent_message_count: usize,
}

#[derive(Clone, Debug)]
pub struct SourceMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct EmbeddingSource {
    pub source_type: String,
    pub source_id: String,
    pub content: String,
    pub sensitivity: String,
}

#[cfg(test)]
mod tests {
    use super::ConsolidationJobRecord;

    #[test]
    fn omits_absent_optional_fields_at_the_frontend_boundary() {
        let value = serde_json::to_value(ConsolidationJobRecord {
            id: "job-1".to_owned(),
            source_type: "conversation".to_owned(),
            source_id: "conversation-1".to_owned(),
            source_version: "message-1".to_owned(),
            status: "pending".to_owned(),
            attempt_count: 0,
            created_at: "2026-06-28T00:00:00Z".to_owned(),
            started_at: None,
            completed_at: None,
            last_error_code: None,
            next_attempt_at: None,
        })
        .expect("serialize");
        assert!(value.get("startedAt").is_none());
        assert!(value.get("completedAt").is_none());
        assert!(value.get("lastErrorCode").is_none());
        assert!(value.get("nextAttemptAt").is_none());
    }
}
