use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::storage::errors::StorageError;
use crate::storage::StorageService;

use super::{
    coordinator::HyperliquidSyncCoordinator,
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    fixtures::{
        scenario_exists, scenario_names, synthetic_fixture_address, SYNTHETIC_FIXTURE_ADDRESS,
    },
    models::{
        CreateHyperliquidAccountRequest, HyperliquidAccountSummary, HyperliquidAddressValidation,
        HyperliquidDiagnostics, HyperliquidFill, HyperliquidFunding, HyperliquidOpenOrder,
        HyperliquidPosition, HyperliquidSyncProgress, HyperliquidSyncResult, IntegrationAccount,
    },
    repository, sync,
    validation::{normalize_hyperliquid_address, shorten_address},
};

const ACTIVE_TRADING_ACCOUNT_EVENT: &str = "trading-buddy://active-trading-account-changed";
const TRADING_EVENT_TARGETS: &[&str] = &["main", "bubble"];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTradingAccountChanged {
    account_id: Option<String>,
}

#[tauri::command]
pub fn validate_hyperliquid_address(address: String) -> HyperliquidAddressValidation {
    match normalize_hyperliquid_address(&address) {
        Ok(normalized_address) => HyperliquidAddressValidation {
            valid: true,
            display_address: Some(shorten_address(&normalized_address)),
            normalized_address: Some(normalized_address),
            error: None,
        },
        Err(error) => HyperliquidAddressValidation {
            valid: false,
            normalized_address: None,
            display_address: None,
            error: Some(error.user_message),
        },
    }
}

#[tauri::command]
pub async fn get_active_hyperliquid_account_id(
    service: State<'_, StorageService>,
) -> Result<Option<String>, TradingError> {
    service
        .run(|connection, _| repository::active_account_id(connection).map_err(to_storage_error))
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn set_active_hyperliquid_account_id(
    account_id: Option<String>,
    service: State<'_, StorageService>,
    app: AppHandle,
) -> Result<Option<String>, TradingError> {
    let active_account_id = service
        .run(move |connection, _| {
            repository::set_active_account_id(connection, account_id.as_deref())
                .map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)?;
    emit_active_account_changed(&app, active_account_id.clone());
    Ok(active_account_id)
}

#[tauri::command]
pub async fn create_hyperliquid_account(
    request: CreateHyperliquidAccountRequest,
    service: State<'_, StorageService>,
) -> Result<IntegrationAccount, TradingError> {
    let fixture_scenario = request.fixture_scenario.clone();
    if let Some(scenario) = fixture_scenario.as_deref() {
        if !scenario_exists(scenario) {
            return Err(TradingError::new(
                TradingErrorCode::FixtureNotAvailable,
                "That Hyperliquid fixture scenario is not available.",
                Some(format!("Unknown fixture scenario: {scenario}")),
                false,
            ));
        }
    }
    let address = fixture_scenario
        .as_deref()
        .map(synthetic_fixture_address)
        .unwrap_or(request.public_address);
    let display_name = request.display_name;
    service
        .run(move |connection, _| {
            repository::create_account(
                connection,
                request.environment,
                &address,
                display_name,
                fixture_scenario.is_some() || address == SYNTHETIC_FIXTURE_ADDRESS,
                fixture_scenario,
            )
            .map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn list_hyperliquid_accounts(
    service: State<'_, StorageService>,
) -> Result<Vec<IntegrationAccount>, TradingError> {
    service
        .run(|connection, _| repository::list_accounts(connection).map_err(to_storage_error))
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn get_hyperliquid_account_summary(
    account_id: String,
    service: State<'_, StorageService>,
) -> Result<HyperliquidAccountSummary, TradingError> {
    service
        .run(move |connection, _| {
            repository::summary(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn sync_hyperliquid_account(
    account_id: String,
    service: State<'_, StorageService>,
    coordinator: State<'_, HyperliquidSyncCoordinator>,
) -> Result<HyperliquidSyncResult, TradingError> {
    let active_sync = coordinator.start(&account_id)?;
    let account = service
        .run({
            let account_id = account_id.clone();
            move |connection, _| {
                repository::get_account(connection, &account_id).map_err(to_storage_error)
            }
        })
        .await
        .map_err(TradingError::from_storage_read)?;
    let data = match sync::fetch_sync_data(&account, Some(&active_sync)).await {
        Ok(data) => data,
        Err(error) => {
            let code = format!("{:?}", error.code).to_ascii_lowercase();
            let status = if error.code == TradingErrorCode::SyncCancelled {
                "cancelled"
            } else {
                "failed"
            };
            let resources_completed = active_sync.resources_completed().unwrap_or_default();
            let run_id = active_sync.run_id().to_owned();
            let started_at = active_sync.started_at().to_owned();
            let _ = service
                .run({
                    let account_id = account_id.clone();
                    let resources_completed = resources_completed.clone();
                    let run_id = run_id.clone();
                    let started_at = started_at.clone();
                    let code = code.clone();
                    move |connection, _| {
                        repository::record_incomplete_sync(
                            connection,
                            &account_id,
                            &run_id,
                            &started_at,
                            status,
                            &code,
                            &resources_completed,
                        )
                        .map_err(to_storage_error)
                    }
                })
                .await;
            return Err(error);
        }
    };
    let run_id = active_sync.run_id().to_owned();
    let started_at = active_sync.started_at().to_owned();
    service
        .run(move |connection, _| {
            repository::persist_sync_with_run(connection, &account_id, data, run_id, started_at)
                .map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn cancel_hyperliquid_sync(
    account_id: String,
    coordinator: State<'_, HyperliquidSyncCoordinator>,
) -> Result<HyperliquidSyncProgress, TradingError> {
    coordinator.cancel(&account_id)
}

#[tauri::command]
pub async fn get_hyperliquid_sync_progress(
    account_id: String,
    coordinator: State<'_, HyperliquidSyncCoordinator>,
) -> Result<HyperliquidSyncProgress, TradingError> {
    coordinator.progress(&account_id)
}

#[tauri::command]
pub async fn pause_hyperliquid_account(
    account_id: String,
    service: State<'_, StorageService>,
) -> Result<IntegrationAccount, TradingError> {
    service
        .run(move |connection, _| {
            repository::pause_account(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn resume_hyperliquid_account(
    account_id: String,
    service: State<'_, StorageService>,
) -> Result<IntegrationAccount, TradingError> {
    service
        .run(move |connection, _| {
            repository::resume_account(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn disconnect_hyperliquid_account(
    account_id: String,
    service: State<'_, StorageService>,
) -> Result<IntegrationAccount, TradingError> {
    service
        .run(move |connection, _| {
            repository::disconnect_account(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn delete_hyperliquid_local_data(
    account_id: String,
    service: State<'_, StorageService>,
    app: AppHandle,
) -> Result<(), TradingError> {
    service
        .run(move |connection, _| {
            repository::delete_local_data(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)?;
    let active_account_id = service
        .run(|connection, _| repository::active_account_id(connection).map_err(to_storage_error))
        .await
        .map_err(TradingError::from_storage_read)?;
    emit_active_account_changed(&app, active_account_id);
    Ok(())
}

#[tauri::command]
pub async fn list_hyperliquid_positions(
    account_id: String,
    service: State<'_, StorageService>,
) -> Result<Vec<HyperliquidPosition>, TradingError> {
    service
        .run(move |connection, _| {
            repository::list_positions(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn list_hyperliquid_fills(
    account_id: String,
    limit: u32,
    offset: u32,
    service: State<'_, StorageService>,
) -> Result<Vec<HyperliquidFill>, TradingError> {
    service
        .run(move |connection, _| {
            repository::list_fills(connection, &account_id, limit, offset).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn list_hyperliquid_funding(
    account_id: String,
    limit: u32,
    offset: u32,
    service: State<'_, StorageService>,
) -> Result<Vec<HyperliquidFunding>, TradingError> {
    service
        .run(move |connection, _| {
            repository::list_funding(connection, &account_id, limit, offset)
                .map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn list_hyperliquid_open_orders(
    account_id: String,
    limit: u32,
    offset: u32,
    service: State<'_, StorageService>,
) -> Result<Vec<HyperliquidOpenOrder>, TradingError> {
    service
        .run(move |connection, _| {
            repository::list_open_orders(connection, &account_id, limit, offset)
                .map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub async fn get_hyperliquid_sync_diagnostics(
    service: State<'_, StorageService>,
) -> Result<HyperliquidDiagnostics, TradingError> {
    service
        .run(|connection, _| repository::diagnostics(connection).map_err(to_storage_error))
        .await
        .map_err(TradingError::from_storage_read)
}

#[tauri::command]
pub fn list_hyperliquid_fixture_scenarios() -> Vec<String> {
    scenario_names()
        .into_iter()
        .map(ToOwned::to_owned)
        .collect()
}

#[allow(dead_code)]
fn _environment_from_string(value: &str) -> Result<HyperliquidEnvironment, TradingError> {
    HyperliquidEnvironment::from_input(value)
}

fn to_storage_error(error: TradingError) -> StorageError {
    StorageError::invalid_request(error.to_string())
}

fn emit_active_account_changed(app: &AppHandle, account_id: Option<String>) {
    let payload = ActiveTradingAccountChanged { account_id };
    for target in TRADING_EVENT_TARGETS {
        let _ = app.emit_to(*target, ACTIVE_TRADING_ACCOUNT_EVENT, payload.clone());
    }
}
