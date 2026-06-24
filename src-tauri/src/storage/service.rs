use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use super::{
    errors::StorageError,
    migrations,
    models::{AppSettings, StorageStatus},
    repository::{cleanup_retention, metadata, recover_interrupted_streams, settings},
};

const DATABASE_FILE_NAME: &str = "trading-buddy.db";

#[derive(Clone)]
pub struct StorageService {
    state: Arc<Mutex<StorageState>>,
}

enum StorageState {
    Ready {
        connection: Connection,
        database_path: PathBuf,
    },
    Unavailable(StorageError),
}

impl StorageService {
    pub fn initialize(app: &AppHandle) -> Self {
        match initialize_database(app) {
            Ok((connection, database_path)) => Self {
                state: Arc::new(Mutex::new(StorageState::Ready {
                    connection,
                    database_path,
                })),
            },
            Err(error) => Self {
                state: Arc::new(Mutex::new(StorageState::Unavailable(error))),
            },
        }
    }

    pub fn status(&self) -> StorageStatus {
        let state = self
            .state
            .lock()
            .expect("storage mutex should not be poisoned");
        match &*state {
            StorageState::Ready {
                connection,
                database_path,
            } => {
                let schema_version = migrations::schema_version(connection).ok();
                StorageStatus {
                    available: true,
                    database_path: Some(database_path.display().to_string()),
                    schema_version,
                    error: None,
                }
            }
            StorageState::Unavailable(error) => StorageStatus {
                available: false,
                database_path: None,
                schema_version: None,
                error: Some(error.clone()),
            },
        }
    }

    pub fn settings_snapshot(&self) -> Result<AppSettings, StorageError> {
        let state = self
            .state
            .lock()
            .map_err(|_| StorageError::database_unavailable("Storage mutex was poisoned."))?;
        match &*state {
            StorageState::Ready { connection, .. } => settings(connection),
            StorageState::Unavailable(error) => Err(error.clone()),
        }
    }

    pub async fn run<T, F>(&self, operation: F) -> Result<T, StorageError>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection, &Path) -> Result<T, StorageError> + Send + 'static,
    {
        let service = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut state = service
                .state
                .lock()
                .map_err(|_| StorageError::database_unavailable("Storage mutex was poisoned."))?;
            match &mut *state {
                StorageState::Ready {
                    connection,
                    database_path,
                } => operation(connection, database_path),
                StorageState::Unavailable(error) => Err(error.clone()),
            }
        })
        .await
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?
    }
}

fn initialize_database(app: &AppHandle) -> Result<(Connection, PathBuf), StorageError> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    let database_path = data_dir.join(DATABASE_FILE_NAME);
    let mut connection = Connection::open(&database_path)
        .map_err(|error| StorageError::database_unavailable(error.to_string()))?;
    migrations::configure_connection(&connection)?;
    migrations::run_migrations(&mut connection)?;
    recover_interrupted_streams(&connection)?;
    cleanup_retention(&connection)?;
    let _ = metadata(&connection)?;
    Ok((connection, database_path))
}
