use chrono::Utc;
use rusqlite::{params, Connection};

use super::errors::StorageError;

pub const CURRENT_SCHEMA_VERSION: i64 = 9;

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial_conversation_storage",
        sql: r#"
CREATE TABLE IF NOT EXISTS storage_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'streaming', 'cancelled', 'failed', 'interrupted')),
  model_name TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  error_code TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  selected_local_model TEXT,
  ambient_animations_enabled INTEGER NOT NULL DEFAULT 1 CHECK (ambient_animations_enabled IN (0, 1)),
  conversation_retention_policy TEXT NOT NULL DEFAULT 'keep_until_delete'
    CHECK (conversation_retention_policy IN ('keep_until_delete', 'delete_after_30_days', 'delete_after_90_days')),
  last_opened_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations(last_message_at DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived_at, last_message_at DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_order ON messages(conversation_id, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id) WHERE request_id IS NOT NULL;

INSERT OR IGNORE INTO app_settings (id, ambient_animations_enabled, conversation_retention_policy)
VALUES (1, 1, 'keep_until_delete');
"#,
    },
    Migration {
        version: 2,
        name: "companion_first_preferences",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN buddy_visible INTEGER NOT NULL DEFAULT 1 CHECK (buddy_visible IN (0, 1));
ALTER TABLE app_settings ADD COLUMN buddy_always_on_top INTEGER NOT NULL DEFAULT 1 CHECK (buddy_always_on_top IN (0, 1));
ALTER TABLE app_settings ADD COLUMN buddy_placement_mode TEXT NOT NULL DEFAULT 'free'
  CHECK (buddy_placement_mode IN ('free', 'dock_left', 'dock_right', 'taskbar_perch'));
ALTER TABLE app_settings ADD COLUMN buddy_free_position_x INTEGER;
ALTER TABLE app_settings ADD COLUMN buddy_free_position_y INTEGER;
ALTER TABLE app_settings ADD COLUMN reduced_movement_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reduced_movement_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN sleep_after_inactivity_seconds INTEGER NOT NULL DEFAULT 900
  CHECK (sleep_after_inactivity_seconds BETWEEN 60 AND 86400);
ALTER TABLE app_settings ADD COLUMN proactive_checkins_enabled INTEGER NOT NULL DEFAULT 1 CHECK (proactive_checkins_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN proactive_checkin_cooldown_minutes INTEGER NOT NULL DEFAULT 180
  CHECK (proactive_checkin_cooldown_minutes BETWEEN 15 AND 1440);
ALTER TABLE app_settings ADD COLUMN quiet_hours_enabled INTEGER NOT NULL DEFAULT 0 CHECK (quiet_hours_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN quiet_hours_start TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE app_settings ADD COLUMN quiet_hours_end TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE app_settings ADD COLUMN do_not_disturb INTEGER NOT NULL DEFAULT 0 CHECK (do_not_disturb IN (0, 1));
ALTER TABLE app_settings ADD COLUMN global_shortcut_enabled INTEGER NOT NULL DEFAULT 1 CHECK (global_shortcut_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN launch_at_login INTEGER NOT NULL DEFAULT 0 CHECK (launch_at_login IN (0, 1));
ALTER TABLE app_settings ADD COLUMN open_companion_home_at_startup INTEGER NOT NULL DEFAULT 0 CHECK (open_companion_home_at_startup IN (0, 1));
ALTER TABLE app_settings ADD COLUMN bubble_width INTEGER NOT NULL DEFAULT 340 CHECK (bubble_width BETWEEN 280 AND 520);
"#,
    },
    Migration {
        version: 3,
        name: "transparent_local_memory",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 1 CHECK (memory_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN memory_approval_mode TEXT NOT NULL DEFAULT 'ask_every_time'
  CHECK (memory_approval_mode IN ('ask_every_time', 'auto_save_ordinary', 'manual_only'));
ALTER TABLE app_settings ADD COLUMN allow_personal_memories INTEGER NOT NULL DEFAULT 1 CHECK (allow_personal_memories IN (0, 1));
ALTER TABLE app_settings ADD COLUMN allow_sensitive_memories INTEGER NOT NULL DEFAULT 0 CHECK (allow_sensitive_memories IN (0, 1));
ALTER TABLE app_settings ADD COLUMN show_memory_used_indicator INTEGER NOT NULL DEFAULT 1 CHECK (show_memory_used_indicator IN (0, 1));
ALTER TABLE app_settings ADD COLUMN memory_candidate_notifications INTEGER NOT NULL DEFAULT 1 CHECK (memory_candidate_notifications IN (0, 1));
ALTER TABLE app_settings ADD COLUMN temporary_memory_default_expiry_days INTEGER NOT NULL DEFAULT 7
  CHECK (temporary_memory_default_expiry_days BETWEEN 1 AND 365);
ALTER TABLE app_settings ADD COLUMN use_memories_in_temporary_chat INTEGER NOT NULL DEFAULT 0 CHECK (use_memories_in_temporary_chat IN (0, 1));

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'preference',
    'goal',
    'personal_rule',
    'communication_style',
    'routine',
    'project',
    'trading_profile',
    'risk_rule',
    'emotional_trigger',
    'important_context',
    'temporary_context',
    'other'
  )),
  content TEXT NOT NULL,
  normalized_content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'rejected', 'expired', 'superseded')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('user_explicit', 'model_proposed', 'user_created', 'system_observation')),
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('ordinary', 'personal', 'sensitive', 'prohibited')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TEXT,
  supersedes_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
USING fts5(memory_id UNINDEXED, content, normalized_content);

CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memory_fts(memory_id, content, normalized_content)
  VALUES (new.id, new.content, new.normalized_content);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF content, normalized_content ON memories BEGIN
  UPDATE memory_fts
  SET content = new.content,
      normalized_content = new.normalized_content
  WHERE memory_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  DELETE FROM memory_fts WHERE memory_id = old.id;
END;

CREATE TABLE IF NOT EXISTS memory_usage_records (
  id TEXT PRIMARY KEY NOT NULL,
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  assistant_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  used_at TEXT NOT NULL,
  reason_code TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_status_updated ON memories(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category, status);
CREATE INDEX IF NOT EXISTS idx_memories_sensitivity ON memories(sensitivity, status);
CREATE INDEX IF NOT EXISTS idx_memories_source_conversation ON memories(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_usage_memory ON memory_usage_records(memory_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_usage_conversation ON memory_usage_records(conversation_id, used_at DESC);
"#,
    },
    Migration {
        version: 4,
        name: "conversational_journaling",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN journaling_enabled INTEGER NOT NULL DEFAULT 1 CHECK (journaling_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN default_journal_mode TEXT NOT NULL DEFAULT 'guided'
  CHECK (default_journal_mode IN ('guided', 'free_write', 'quick_check_in', 'end_of_day'));
ALTER TABLE app_settings ADD COLUMN default_entry_private INTEGER NOT NULL DEFAULT 1 CHECK (default_entry_private IN (0, 1));
ALTER TABLE app_settings ADD COLUMN allow_memory_candidates_from_journal INTEGER NOT NULL DEFAULT 0 CHECK (allow_memory_candidates_from_journal IN (0, 1));
ALTER TABLE app_settings ADD COLUMN daily_check_in_enabled INTEGER NOT NULL DEFAULT 0 CHECK (daily_check_in_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN daily_check_in_time TEXT;
ALTER TABLE app_settings ADD COLUMN evening_review_enabled INTEGER NOT NULL DEFAULT 0 CHECK (evening_review_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN evening_review_time TEXT;
ALTER TABLE app_settings ADD COLUMN journal_check_in_cooldown_minutes INTEGER NOT NULL DEFAULT 180
  CHECK (journal_check_in_cooldown_minutes BETWEEN 15 AND 1440);
ALTER TABLE app_settings ADD COLUMN show_mood_prompt INTEGER NOT NULL DEFAULT 1 CHECK (show_mood_prompt IN (0, 1));
ALTER TABLE app_settings ADD COLUMN show_energy_prompt INTEGER NOT NULL DEFAULT 1 CHECK (show_energy_prompt IN (0, 1));

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'free_reflection',
    'daily_check_in',
    'end_of_day_review',
    'idea',
    'life',
    'money',
    'trading_session',
    'gratitude',
    'decision',
    'other'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed', 'discarded')),
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'desktop_guided',
    'desktop_free_write',
    'companion_home',
    'conversation_conversion',
    'user_created'
  )),
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  stress INTEGER CHECK (stress BETWEEN 1 AND 5),
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  allow_memory_candidates INTEGER NOT NULL DEFAULT 0 CHECK (allow_memory_candidates IN (0, 1)),
  is_private INTEGER NOT NULL DEFAULT 1 CHECK (is_private IN (0, 1))
);

CREATE TABLE IF NOT EXISTS journal_tags (
  id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entry_tags (
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES journal_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS journal_fts
USING fts5(entry_id UNINDEXED, title, body, summary, tags);

CREATE TRIGGER IF NOT EXISTS journal_entries_ai AFTER INSERT ON journal_entries BEGIN
  INSERT INTO journal_fts(entry_id, title, body, summary, tags)
  VALUES (new.id, new.title, new.body, COALESCE(new.summary, ''), '');
END;

CREATE TRIGGER IF NOT EXISTS journal_entries_au AFTER UPDATE OF title, body, summary ON journal_entries BEGIN
  UPDATE journal_fts
  SET title = new.title,
      body = new.body,
      summary = COALESCE(new.summary, '')
  WHERE entry_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS journal_entries_ad AFTER DELETE ON journal_entries BEGIN
  DELETE FROM journal_fts WHERE entry_id = old.id;
END;

CREATE INDEX IF NOT EXISTS idx_journal_entries_status_updated ON journal_entries(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_kind_status ON journal_entries(kind, status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_occurred ON journal_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_conversation ON journal_entries(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_journal_tags_value ON journal_tags(value);
CREATE INDEX IF NOT EXISTS idx_journal_entry_tags_tag ON journal_entry_tags(tag_id, entry_id);
"#,
    },
    Migration {
        version: 5,
        name: "read_only_trading_integrations",
        sql: r#"
CREATE TABLE IF NOT EXISTS integration_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('hyperliquid')),
  environment TEXT NOT NULL CHECK (environment IN ('mainnet', 'testnet')),
  public_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error', 'disconnected')),
  sync_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sync_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_started_at TEXT,
  last_sync_completed_at TEXT,
  last_sync_error_code TEXT,
  last_successful_data_at TEXT,
  is_fixture INTEGER NOT NULL DEFAULT 0 CHECK (is_fixture IN (0, 1)),
  UNIQUE(provider, environment, normalized_address)
);

CREATE TABLE IF NOT EXISTS integration_sync_state (
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('metadata', 'account_state', 'positions', 'fills', 'funding', 'open_orders')),
  cursor TEXT,
  oldest_synced_at TEXT,
  newest_synced_at TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id, resource_kind)
);

CREATE TABLE IF NOT EXISTS hyperliquid_market_metadata (
  environment TEXT NOT NULL CHECK (environment IN ('mainnet', 'testnet')),
  asset_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  display_symbol TEXT NOT NULL,
  size_decimals INTEGER NOT NULL,
  price_decimals INTEGER,
  max_leverage INTEGER,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
  source_updated_at TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY(environment, asset_key)
);

CREATE TABLE IF NOT EXISTS hyperliquid_account_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  account_value TEXT,
  total_margin_used TEXT,
  withdrawable TEXT,
  total_raw_usd TEXT,
  snapshot_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1))
);

CREATE TABLE IF NOT EXISTS hyperliquid_position_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short', 'flat')),
  signed_size TEXT NOT NULL,
  absolute_size TEXT NOT NULL,
  entry_price TEXT,
  mark_price TEXT,
  notional TEXT,
  leverage_type TEXT,
  leverage_value TEXT,
  liquidation_price TEXT,
  margin_used TEXT,
  unrealized_pnl TEXT,
  return_on_equity TEXT,
  snapshot_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1))
);

CREATE TABLE IF NOT EXISTS hyperliquid_fills (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  source_fill_identity TEXT NOT NULL,
  source_transaction_hash TEXT,
  source_order_id TEXT,
  asset_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  direction TEXT,
  price TEXT NOT NULL,
  size TEXT NOT NULL,
  notional TEXT,
  fee TEXT NOT NULL,
  fee_token TEXT,
  closed_pnl TEXT,
  fill_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(account_id, source_fill_identity)
);

CREATE TABLE IF NOT EXISTS hyperliquid_funding (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  source_funding_identity TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  funding_rate TEXT,
  position_size TEXT,
  event_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(account_id, source_funding_identity)
);

CREATE TABLE IF NOT EXISTS hyperliquid_open_order_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  source_order_id TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT,
  price TEXT,
  size TEXT NOT NULL,
  original_size TEXT,
  reduce_only INTEGER CHECK (reduce_only IN (0, 1)),
  trigger_price TEXT,
  order_timestamp TEXT,
  snapshot_timestamp TEXT NOT NULL,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1))
);

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'cancelled')),
  resources_requested_json TEXT NOT NULL,
  resources_completed_json TEXT NOT NULL,
  error_code TEXT,
  records_inserted INTEGER NOT NULL DEFAULT 0 CHECK (records_inserted >= 0),
  records_updated INTEGER NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
  records_unchanged INTEGER NOT NULL DEFAULT 0 CHECK (records_unchanged >= 0)
);

CREATE INDEX IF NOT EXISTS idx_integration_accounts_provider_environment ON integration_accounts(provider, environment, status);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_fixture ON integration_accounts(is_fixture, provider);
CREATE INDEX IF NOT EXISTS idx_hl_account_snapshots_current ON hyperliquid_account_snapshots(account_id, is_current, snapshot_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hl_positions_current ON hyperliquid_position_snapshots(account_id, is_current, symbol);
CREATE INDEX IF NOT EXISTS idx_hl_fills_account_time ON hyperliquid_fills(account_id, fill_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hl_funding_account_time ON hyperliquid_funding(account_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hl_orders_current ON hyperliquid_open_order_snapshots(account_id, is_current, symbol);
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_account_time ON integration_sync_runs(account_id, started_at DESC);
"#,
    },
    Migration {
        version: 6,
        name: "fixture_scenario_identity",
        sql: r#"
ALTER TABLE integration_accounts ADD COLUMN fixture_scenario TEXT;

UPDATE integration_accounts
SET fixture_scenario = display_name
WHERE provider = 'hyperliquid'
  AND is_fixture = 1
  AND display_name IS NOT NULL
  AND fixture_scenario IS NULL;

CREATE INDEX IF NOT EXISTS idx_integration_accounts_fixture_scenario
ON integration_accounts(provider, is_fixture, fixture_scenario);
"#,
    },
    Migration {
        version: 7,
        name: "active_trading_account_setting",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN active_hyperliquid_account_id TEXT
  REFERENCES integration_accounts(id) ON DELETE SET NULL;
"#,
    },
    Migration {
        version: 8,
        name: "creature_movement_preferences",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN autonomous_movement_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (autonomous_movement_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN movement_intensity TEXT NOT NULL DEFAULT 'medium'
  CHECK (movement_intensity IN ('low', 'medium', 'lively'));
ALTER TABLE app_settings ADD COLUMN surface_interaction_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (surface_interaction_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN follow_moving_surfaces INTEGER NOT NULL DEFAULT 1
  CHECK (follow_moving_surfaces IN (0, 1));
ALTER TABLE app_settings ADD COLUMN cursor_awareness_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (cursor_awareness_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN multi_monitor_wandering_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (multi_monitor_wandering_enabled IN (0, 1));
"#,
    },
    Migration {
        version: 9,
        name: "local_continuity_foundation",
        sql: r#"
ALTER TABLE app_settings ADD COLUMN conversation_compaction_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (conversation_compaction_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN semantic_memory_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (semantic_memory_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN consolidation_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (consolidation_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN automatic_ordinary_learning_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (automatic_ordinary_learning_enabled IN (0, 1));
ALTER TABLE app_settings ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'embeddinggemma:300m';
ALTER TABLE app_settings ADD COLUMN embed_sensitive_content INTEGER NOT NULL DEFAULT 0
  CHECK (embed_sensitive_content IN (0, 1));
ALTER TABLE app_settings ADD COLUMN continuity_recent_message_count INTEGER NOT NULL DEFAULT 12
  CHECK (continuity_recent_message_count BETWEEN 4 AND 40);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary_version INTEGER NOT NULL CHECK (summary_version > 0),
  summarized_through_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  structured_summary_json TEXT NOT NULL,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('ollama', 'fixture')),
  model_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(conversation_id, summary_version)
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'life_event', 'emotional_moment', 'project', 'decision', 'achievement', 'setback',
    'shared_activity', 'conversation', 'other'
  )),
  occurred_at TEXT,
  importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1),
  emotional_significance REAL NOT NULL CHECK (emotional_significance >= 0 AND emotional_significance <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('ordinary', 'personal', 'sensitive', 'prohibited')),
  status TEXT NOT NULL CHECK (status IN (
    'proposed', 'confirmed', 'automatic_ordinary', 'rejected', 'superseded', 'deleted'
  )),
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  supersedes_episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0)
);

CREATE TABLE IF NOT EXISTS episode_sources (
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  sequence_index INTEGER NOT NULL CHECK (sequence_index >= 0),
  PRIMARY KEY (episode_id, message_id)
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person', 'pet', 'project', 'company', 'community', 'place', 'product', 'goal', 'idea', 'other'
  )),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('ordinary', 'personal', 'sensitive', 'prohibited')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'rejected', 'superseded', 'deleted')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  first_mentioned_at TEXT NOT NULL,
  last_mentioned_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  UNIQUE(entity_type, normalized_name)
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (entity_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS entity_mentions (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_at TEXT NOT NULL,
  PRIMARY KEY (entity_id, message_id)
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id TEXT PRIMARY KEY NOT NULL,
  subject_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  predicate TEXT NOT NULL,
  object_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  object_text TEXT,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('ordinary', 'personal', 'sensitive', 'prohibited')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'rejected', 'superseded', 'deleted')),
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (object_entity_id IS NOT NULL OR object_text IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS episode_entities (
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (episode_id, entity_id, role)
);

CREATE TABLE IF NOT EXISTS current_life_context (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  normalized_content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'expired', 'superseded', 'deleted')),
  importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('ordinary', 'personal', 'sensitive', 'prohibited')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0)
);

CREATE TABLE IF NOT EXISTS embedding_models (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ollama')),
  model TEXT NOT NULL,
  model_digest TEXT,
  dimension INTEGER NOT NULL CHECK (dimension > 0 AND dimension <= 16384),
  status TEXT NOT NULL CHECK (status IN ('ready', 'missing', 'unavailable', 'stale')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, model, dimension)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'memory', 'conversation_summary', 'episode', 'entity', 'current_life_context'
  )),
  source_id TEXT NOT NULL,
  embedding_model_id TEXT NOT NULL REFERENCES embedding_models(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  vector_blob BLOB NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_type, source_id, embedding_model_id)
);

CREATE TABLE IF NOT EXISTS consolidation_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('conversation', 'memory', 'journal', 'manual')),
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled', 'superseded'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 5),
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error_code TEXT,
  next_attempt_at TEXT,
  UNIQUE(source_type, source_id, source_version)
);

CREATE TABLE IF NOT EXISTS continuity_usage_records (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'memory', 'conversation_summary', 'episode', 'entity', 'current_life_context'
  )),
  source_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  assistant_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  used_at TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  score REAL NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS episode_fts
USING fts5(episode_id UNINDEXED, title, summary);
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts
USING fts5(entity_id UNINDEXED, canonical_name, normalized_name, aliases);
CREATE VIRTUAL TABLE IF NOT EXISTS current_life_fts
USING fts5(context_id UNINDEXED, category, content, normalized_content);
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_summary_fts
USING fts5(summary_id UNINDEXED, structured_summary_json);

CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
  INSERT INTO episode_fts(episode_id, title, summary) VALUES (new.id, new.title, new.summary);
END;
CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE OF title, summary ON episodes BEGIN
  UPDATE episode_fts SET title = new.title, summary = new.summary WHERE episode_id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
  DELETE FROM episode_fts WHERE episode_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entity_fts(entity_id, canonical_name, normalized_name, aliases)
  VALUES (new.id, new.canonical_name, new.normalized_name, '');
END;
CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE OF canonical_name, normalized_name ON entities BEGIN
  UPDATE entity_fts SET canonical_name = new.canonical_name, normalized_name = new.normalized_name
  WHERE entity_id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  DELETE FROM entity_fts WHERE entity_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS current_life_ai AFTER INSERT ON current_life_context BEGIN
  INSERT INTO current_life_fts(context_id, category, content, normalized_content)
  VALUES (new.id, new.category, new.content, new.normalized_content);
END;
CREATE TRIGGER IF NOT EXISTS current_life_au AFTER UPDATE OF category, content, normalized_content ON current_life_context BEGIN
  UPDATE current_life_fts
  SET category = new.category, content = new.content, normalized_content = new.normalized_content
  WHERE context_id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS current_life_ad AFTER DELETE ON current_life_context BEGIN
  DELETE FROM current_life_fts WHERE context_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS conversation_summaries_ai AFTER INSERT ON conversation_summaries BEGIN
  INSERT INTO conversation_summary_fts(summary_id, structured_summary_json)
  VALUES (new.id, new.structured_summary_json);
END;
CREATE TRIGGER IF NOT EXISTS conversation_summaries_au AFTER UPDATE OF structured_summary_json ON conversation_summaries BEGIN
  UPDATE conversation_summary_fts SET structured_summary_json = new.structured_summary_json
  WHERE summary_id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS conversation_summaries_ad AFTER DELETE ON conversation_summaries BEGIN
  DELETE FROM conversation_summary_fts WHERE summary_id = old.id;
END;

CREATE INDEX IF NOT EXISTS idx_summaries_conversation_version
  ON conversation_summaries(conversation_id, summary_version DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_status_time
  ON episodes(status, occurred_at DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_episode_sources_message ON episode_sources(message_id);
CREATE INDEX IF NOT EXISTS idx_entities_status_name ON entities(status, normalized_name);
CREATE INDEX IF NOT EXISTS idx_entity_alias_normalized ON entity_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_conversation ON entity_mentions(conversation_id, mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_subject ON entity_relationships(subject_entity_id, status);
CREATE INDEX IF NOT EXISTS idx_episode_entities_entity ON episode_entities(entity_id, episode_id);
CREATE INDEX IF NOT EXISTS idx_current_life_status_expiry ON current_life_context(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id, stale);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(embedding_model_id, stale, source_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status_retry ON consolidation_jobs(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_continuity_usage_source ON continuity_usage_records(source_type, source_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_continuity_usage_conversation ON continuity_usage_records(conversation_id, used_at DESC);
"#,
    },
];

pub fn configure_connection(connection: &Connection) -> Result<(), StorageError> {
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    connection
        .pragma_update(None, "busy_timeout", 5_000)
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    connection
        .pragma_update(None, "secure_delete", "ON")
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    Ok(())
}

pub fn run_migrations(connection: &mut Connection) -> Result<(), StorageError> {
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS storage_metadata (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            )",
            [],
        )
        .map_err(|error| StorageError::migration_failed(error.to_string()))?;

    let now = Utc::now().to_rfc3339();
    connection
        .execute(
            "INSERT OR IGNORE INTO storage_metadata (key, value) VALUES ('application_created_at', ?1)",
            params![now],
        )
        .map_err(|error| StorageError::migration_failed(error.to_string()))?;

    let mut current = schema_version(connection)?;
    for migration in MIGRATIONS {
        if migration.version <= current {
            continue;
        }
        let transaction = connection
            .transaction()
            .map_err(|error| StorageError::migration_failed(error.to_string()))?;
        transaction.execute_batch(migration.sql).map_err(|error| {
            StorageError::migration_failed(format!(
                "Migration {} ({}) failed: {error}",
                migration.version, migration.name
            ))
        })?;
        let migrated_at = Utc::now().to_rfc3339();
        transaction
            .execute(
                "INSERT INTO storage_metadata (key, value) VALUES ('schema_version', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![migration.version.to_string()],
            )
            .map_err(|error| StorageError::migration_failed(error.to_string()))?;
        transaction
            .execute(
                "INSERT INTO storage_metadata (key, value) VALUES ('last_successful_migration_at', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![migrated_at],
            )
            .map_err(|error| StorageError::migration_failed(error.to_string()))?;
        transaction
            .commit()
            .map_err(|error| StorageError::migration_failed(error.to_string()))?;
        current = migration.version;
    }

    if schema_version(connection)? != CURRENT_SCHEMA_VERSION {
        return Err(StorageError::migration_failed(
            "Database schema version did not reach the expected version.",
        ));
    }

    Ok(())
}

pub fn schema_version(connection: &Connection) -> Result<i64, StorageError> {
    let value: Option<String> = connection
        .query_row(
            "SELECT value FROM storage_metadata WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| StorageError::migration_failed(error.to_string()))?;
    value
        .as_deref()
        .unwrap_or("0")
        .parse::<i64>()
        .map_err(|error| StorageError::invalid_stored_data(error.to_string()))
}

trait OptionalRow<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalRow<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{configure_connection, run_migrations, schema_version, CURRENT_SCHEMA_VERSION};

    #[test]
    fn initializes_empty_database() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        assert_eq!(
            schema_version(&connection).expect("version"),
            CURRENT_SCHEMA_VERSION
        );
    }

    #[test]
    fn reruns_migrations_safely() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate once");
        run_migrations(&mut connection).expect("migrate twice");
        let settings_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM app_settings", [], |row| row.get(0))
            .expect("settings count");
        assert_eq!(settings_count, 1);
    }

    #[test]
    fn enables_foreign_keys() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        let enabled: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .expect("foreign keys");
        assert_eq!(enabled, 1);
    }

    #[test]
    fn creates_required_indexes() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'
                 AND name IN ('idx_conversations_activity', 'idx_messages_conversation_order', 'idx_messages_request_id', 'idx_memories_status_updated')",
                [],
                |row| row.get(0),
            )
            .expect("index count");
        assert_eq!(count, 4);
    }

    #[test]
    fn creates_continuity_tables_without_replacing_existing_memory() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        run_migrations(&mut connection).expect("migrate");
        connection
            .execute(
                "INSERT INTO memories (
                    id, category, content, normalized_content, status, source_kind,
                    confidence, importance, sensitivity, created_at, updated_at, use_count
                 ) VALUES (
                    'memory-existing', 'project', 'FarmTown is a project.',
                    'farmtown is a project.', 'confirmed', 'user_created',
                    1.0, 0.8, 'ordinary', '2026-06-27T00:00:00Z',
                    '2026-06-27T00:00:00Z', 0
                 )",
                [],
            )
            .expect("insert existing memory");
        run_migrations(&mut connection).expect("rerun");

        let continuity_table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table'
                   AND name IN (
                     'conversation_summaries', 'episodes', 'entities',
                     'current_life_context', 'embedding_models', 'embeddings',
                     'consolidation_jobs', 'continuity_usage_records'
                   )",
                [],
                |row| row.get(0),
            )
            .expect("continuity tables");
        let existing_memory_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM memories WHERE id = 'memory-existing'",
                [],
                |row| row.get(0),
            )
            .expect("memory count");
        assert_eq!(continuity_table_count, 8);
        assert_eq!(existing_memory_count, 1);
    }
}
