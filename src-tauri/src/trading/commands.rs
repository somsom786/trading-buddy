use tauri::State;

use crate::storage::errors::StorageError;
use crate::storage::StorageService;

use super::{
    environment::HyperliquidEnvironment,
    errors::TradingError,
    fixtures::{scenario_names, SYNTHETIC_FIXTURE_ADDRESS},
    models::{
        CreateHyperliquidAccountRequest, HyperliquidAccountSummary, HyperliquidAddressValidation,
        HyperliquidDiagnostics, HyperliquidFill, HyperliquidFunding, HyperliquidOpenOrder,
        HyperliquidPosition, HyperliquidSyncResult, IntegrationAccount,
    },
    repository, sync,
    validation::{normalize_hyperliquid_address, shorten_address},
};

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
pub async fn create_hyperliquid_account(
    request: CreateHyperliquidAccountRequest,
    service: State<'_, StorageService>,
) -> Result<IntegrationAccount, TradingError> {
    let address = if request.fixture_scenario.is_some() {
        SYNTHETIC_FIXTURE_ADDRESS.to_owned()
    } else {
        request.public_address
    };
    let display_name = request.fixture_scenario.or(request.display_name);
    service
        .run(move |connection, _| {
            repository::create_account(
                connection,
                request.environment,
                &address,
                display_name,
                address == SYNTHETIC_FIXTURE_ADDRESS,
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
) -> Result<HyperliquidSyncResult, TradingError> {
    let account = service
        .run({
            let account_id = account_id.clone();
            move |connection, _| {
                repository::get_account(connection, &account_id).map_err(to_storage_error)
            }
        })
        .await
        .map_err(TradingError::from_storage_read)?;
    let data = match sync::fetch_sync_data(&account).await {
        Ok(data) => data,
        Err(error) => {
            let code = format!("{:?}", error.code).to_ascii_lowercase();
            let _ = service
                .run({
                    let account_id = account_id.clone();
                    move |connection, _| {
                        repository::fail_sync(connection, &account_id, &code)
                            .map_err(to_storage_error)
                    }
                })
                .await;
            return Err(error);
        }
    };
    service
        .run(move |connection, _| {
            repository::persist_sync(connection, &account_id, data).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
}

#[tauri::command]
pub async fn cancel_hyperliquid_sync(account_id: String) -> Result<(), TradingError> {
    let _ = account_id;
    Err(TradingError::invalid_request(
        "No cancellable Hyperliquid sync is currently running.",
    ))
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
) -> Result<(), TradingError> {
    service
        .run(move |connection, _| {
            repository::delete_local_data(connection, &account_id).map_err(to_storage_error)
        })
        .await
        .map_err(TradingError::from_storage_write)
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
