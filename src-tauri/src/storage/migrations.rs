use chrono::Utc;
use rusqlite::{params, Connection};

use super::errors::StorageError;

pub const CURRENT_SCHEMA_VERSION: i64 = 2;

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
                 AND name IN ('idx_conversations_activity', 'idx_messages_conversation_order', 'idx_messages_request_id')",
                [],
                |row| row.get(0),
            )
            .expect("index count");
        assert_eq!(count, 3);
    }
}
