use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use chrono::Utc;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::{
    errors::{TradingError, TradingErrorCode},
    models::HyperliquidSyncProgress,
};

pub struct HyperliquidSyncCoordinator {
    active: Arc<Mutex<HashMap<String, Arc<ActiveSyncState>>>>,
}

pub struct ActiveHyperliquidSync {
    account_id: String,
    state: Arc<ActiveSyncState>,
    coordinator: HyperliquidSyncCoordinatorHandle,
}

#[derive(Clone)]
struct HyperliquidSyncCoordinatorHandle {
    active: Arc<Mutex<HashMap<String, Arc<ActiveSyncState>>>>,
}

struct ActiveSyncState {
    run_id: String,
    started_at: String,
    token: CancellationToken,
    inner: Mutex<ActiveSyncInner>,
}

#[derive(Default)]
struct ActiveSyncInner {
    status: String,
    current_resource: Option<String>,
    resources_completed: Vec<String>,
    cancel_requested: bool,
}

impl HyperliquidSyncCoordinator {
    pub fn new() -> Self {
        Self {
            active: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(&self, account_id: &str) -> Result<ActiveHyperliquidSync, TradingError> {
        let mut active = self.active.lock().map_err(|_| lock_error())?;
        if active.contains_key(account_id) {
            return Err(TradingError::new(
                TradingErrorCode::SyncAlreadyRunning,
                "A Hyperliquid refresh is already running for this account.",
                None,
                true,
            ));
        }
        let state = Arc::new(ActiveSyncState {
            run_id: format!("hl_sync_{}", Uuid::new_v4()),
            started_at: Utc::now().to_rfc3339(),
            token: CancellationToken::new(),
            inner: Mutex::new(ActiveSyncInner {
                status: "running".to_owned(),
                ..ActiveSyncInner::default()
            }),
        });
        active.insert(account_id.to_owned(), state.clone());
        Ok(ActiveHyperliquidSync {
            account_id: account_id.to_owned(),
            state,
            coordinator: HyperliquidSyncCoordinatorHandle {
                active: self.active.clone(),
            },
        })
    }

    pub fn cancel(&self, account_id: &str) -> Result<HyperliquidSyncProgress, TradingError> {
        let active = self.active.lock().map_err(|_| lock_error())?;
        let Some(state) = active.get(account_id) else {
            return Err(TradingError::invalid_request(
                "No cancellable Hyperliquid sync is currently running.",
            ));
        };
        state.request_cancel()?;
        progress_from_state(account_id, state)
    }

    pub fn progress(&self, account_id: &str) -> Result<HyperliquidSyncProgress, TradingError> {
        let active = self.active.lock().map_err(|_| lock_error())?;
        let Some(state) = active.get(account_id) else {
            return Ok(HyperliquidSyncProgress {
                account_id: account_id.to_owned(),
                run_id: None,
                status: "idle".to_owned(),
                started_at: None,
                current_resource: None,
                resources_completed: Vec::new(),
                cancel_requested: false,
            });
        };
        progress_from_state(account_id, state)
    }
}

impl ActiveHyperliquidSync {
    pub fn run_id(&self) -> &str {
        &self.state.run_id
    }

    pub fn started_at(&self) -> &str {
        &self.state.started_at
    }

    pub fn resources_completed(&self) -> Result<Vec<String>, TradingError> {
        Ok(self
            .state
            .inner
            .lock()
            .map_err(|_| lock_error())?
            .resources_completed
            .clone())
    }

    pub fn set_current_resource(&self, resource: &str) -> Result<(), TradingError> {
        let mut inner = self.state.inner.lock().map_err(|_| lock_error())?;
        inner.current_resource = Some(resource.to_owned());
        Ok(())
    }

    pub fn complete_resource(&self, resource: &str) -> Result<(), TradingError> {
        let mut inner = self.state.inner.lock().map_err(|_| lock_error())?;
        inner.current_resource = None;
        if !inner
            .resources_completed
            .iter()
            .any(|completed| completed == resource)
        {
            inner.resources_completed.push(resource.to_owned());
        }
        Ok(())
    }

    pub fn check_cancelled(&self, resource: &str) -> Result<(), TradingError> {
        if self.state.token.is_cancelled() {
            return Err(TradingError::new(
                TradingErrorCode::SyncCancelled,
                "Hyperliquid refresh was cancelled. Last saved data remains available.",
                Some(format!("Cancelled during {resource}")),
                false,
            )
            .resource(resource));
        }
        Ok(())
    }
}

impl Drop for ActiveHyperliquidSync {
    fn drop(&mut self) {
        if let Ok(mut active) = self.coordinator.active.lock() {
            active.remove(&self.account_id);
        }
    }
}

impl ActiveSyncState {
    fn request_cancel(&self) -> Result<(), TradingError> {
        self.token.cancel();
        let mut inner = self.inner.lock().map_err(|_| lock_error())?;
        inner.status = "cancelling".to_owned();
        inner.cancel_requested = true;
        Ok(())
    }
}

fn progress_from_state(
    account_id: &str,
    state: &ActiveSyncState,
) -> Result<HyperliquidSyncProgress, TradingError> {
    let inner = state.inner.lock().map_err(|_| lock_error())?;
    Ok(HyperliquidSyncProgress {
        account_id: account_id.to_owned(),
        run_id: Some(state.run_id.clone()),
        status: inner.status.clone(),
        started_at: Some(state.started_at.clone()),
        current_resource: inner.current_resource.clone(),
        resources_completed: inner.resources_completed.clone(),
        cancel_requested: inner.cancel_requested,
    })
}

fn lock_error() -> TradingError {
    TradingError::new(
        TradingErrorCode::ResourceUnavailable,
        "Trading Buddy could not read sync state.",
        None,
        true,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_coalescing_cancellation_and_drop_cleanup() {
        let coordinator = HyperliquidSyncCoordinator::new();
        {
            let active = coordinator.start("account_1").unwrap();
            assert!(coordinator.start("account_1").is_err());
            active.set_current_resource("fills").unwrap();
            let cancelling = coordinator.cancel("account_1").unwrap();
            assert_eq!(cancelling.status, "cancelling");
            assert!(cancelling.cancel_requested);
            assert!(active.check_cancelled("fills").is_err());
        }
        let idle = coordinator.progress("account_1").unwrap();
        assert_eq!(idle.status, "idle");
    }
}
