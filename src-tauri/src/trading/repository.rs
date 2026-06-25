use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::{
    environment::HyperliquidEnvironment,
    errors::{TradingError, TradingErrorCode},
    models::{
        HyperliquidAccountSummary, HyperliquidDiagnostics, HyperliquidFill, HyperliquidFunding,
        HyperliquidOpenOrder, HyperliquidPosition, HyperliquidSyncResult, IntegrationAccount,
        IntegrationAccountStatus, NormalizedSyncData, PROVIDER,
    },
    validation::{normalize_hyperliquid_address, shorten_address},
};

const MAX_LIST_LIMIT: u32 = 100;

pub fn create_account(
    connection: &mut Connection,
    environment: HyperliquidEnvironment,
    public_address: &str,
    display_name: Option<String>,
    is_fixture: bool,
) -> Result<IntegrationAccount, TradingError> {
    let normalized_address = normalize_hyperliquid_address(public_address)?;
    let now = Utc::now().to_rfc3339();
    let id = format!("hl_{}", Uuid::new_v4());
    let display_name = display_name.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.chars().take(80).collect::<String>())
    });
    let result = connection.execute(
        "INSERT INTO integration_accounts (
          id, provider, environment, public_address, normalized_address, display_name, status,
          sync_enabled, created_at, updated_at, is_fixture
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', 1, ?7, ?7, ?8)",
        params![
            id,
            PROVIDER,
            environment.as_db(),
            public_address.trim(),
            normalized_address,
            display_name,
            now,
            bool_to_i64(is_fixture)
        ],
    );
    match result {
        Ok(_) => get_account(connection, &id),
        Err(error) if is_unique_error(&error) => Err(TradingError::new(
            TradingErrorCode::DuplicateAccount,
            "That Hyperliquid account is already connected for this environment.",
            Some(error.to_string()),
            false,
        )),
        Err(error) => Err(TradingError::new(
            TradingErrorCode::DatabaseWriteFailed,
            "Trading Buddy could not save the Hyperliquid account.",
            Some(error.to_string()),
            true,
        )),
    }
}

pub fn list_accounts(connection: &Connection) -> Result<Vec<IntegrationAccount>, TradingError> {
    let mut statement = connection.prepare(
        "SELECT id, provider, environment, public_address, normalized_address, display_name, status,
         sync_enabled, created_at, updated_at, last_sync_started_at, last_sync_completed_at,
         last_sync_error_code, last_successful_data_at, is_fixture
         FROM integration_accounts
         WHERE provider = ?1
         ORDER BY created_at DESC",
    )?;
    let rows = statement.query_map(params![PROVIDER], map_account)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(TradingError::from)
}

pub fn get_account(
    connection: &Connection,
    account_id: &str,
) -> Result<IntegrationAccount, TradingError> {
    connection
        .query_row(
            "SELECT id, provider, environment, public_address, normalized_address, display_name, status,
             sync_enabled, created_at, updated_at, last_sync_started_at, last_sync_completed_at,
             last_sync_error_code, last_successful_data_at, is_fixture
             FROM integration_accounts
             WHERE id = ?1 AND provider = ?2",
            params![account_id, PROVIDER],
            map_account,
        )
        .optional()?
        .ok_or_else(TradingError::account_not_found)
}

pub fn pause_account(
    connection: &Connection,
    account_id: &str,
) -> Result<IntegrationAccount, TradingError> {
    update_account_status(
        connection,
        account_id,
        IntegrationAccountStatus::Paused,
        false,
    )
}

pub fn resume_account(
    connection: &Connection,
    account_id: &str,
) -> Result<IntegrationAccount, TradingError> {
    update_account_status(
        connection,
        account_id,
        IntegrationAccountStatus::Active,
        true,
    )
}

pub fn disconnect_account(
    connection: &Connection,
    account_id: &str,
) -> Result<IntegrationAccount, TradingError> {
    update_account_status(
        connection,
        account_id,
        IntegrationAccountStatus::Disconnected,
        false,
    )
}

pub fn delete_local_data(
    connection: &mut Connection,
    account_id: &str,
) -> Result<(), TradingError> {
    let transaction = connection.transaction().map_err(write_error)?;
    let deleted = transaction
        .execute(
            "DELETE FROM integration_accounts WHERE id = ?1 AND provider = ?2",
            params![account_id, PROVIDER],
        )
        .map_err(write_error)?;
    if deleted == 0 {
        return Err(TradingError::account_not_found());
    }
    transaction.commit().map_err(write_error)?;
    Ok(())
}

pub fn persist_sync(
    connection: &mut Connection,
    account_id: &str,
    data: NormalizedSyncData,
) -> Result<HyperliquidSyncResult, TradingError> {
    let account = get_account(connection, account_id)?;
    if account.status == IntegrationAccountStatus::Paused
        || account.status == IntegrationAccountStatus::Disconnected
    {
        return Err(TradingError::invalid_request(
            "Paused or disconnected accounts cannot be refreshed.",
        ));
    }

    let started_at = Utc::now().to_rfc3339();
    let run_id = format!("hl_sync_{}", Uuid::new_v4());
    let resources_requested =
        r#"["metadata","account_state","positions","fills","funding","open_orders"]"#;
    let transaction = connection.transaction().map_err(write_error)?;
    transaction
        .execute(
            "INSERT INTO integration_sync_runs (
              id, account_id, started_at, status, resources_requested_json, resources_completed_json
            ) VALUES (?1, ?2, ?3, 'running', ?4, '[]')",
            params![run_id, account_id, started_at, resources_requested],
        )
        .map_err(write_error)?;
    transaction
        .execute(
            "UPDATE integration_accounts SET last_sync_started_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![started_at, account_id],
        )
        .map_err(write_error)?;

    let mut inserted = 0u32;
    let mut updated = 0u32;
    let mut unchanged = 0u32;
    let received_at = Utc::now().to_rfc3339();

    for asset in data.metadata {
        let changed = transaction
            .execute(
                "INSERT INTO hyperliquid_market_metadata (
                  environment, asset_key, symbol, display_symbol, size_decimals, price_decimals,
                  max_leverage, is_active, source_updated_at, received_at
                ) VALUES (?1, ?2, ?3, ?3, ?4, NULL, ?5, ?6, NULL, ?7)
                ON CONFLICT(environment, asset_key) DO UPDATE SET
                  symbol = excluded.symbol,
                  display_symbol = excluded.display_symbol,
                  size_decimals = excluded.size_decimals,
                  max_leverage = excluded.max_leverage,
                  is_active = excluded.is_active,
                  received_at = excluded.received_at",
                params![
                    account.environment.as_db(),
                    asset.asset_key,
                    asset.symbol,
                    asset.size_decimals,
                    asset.max_leverage,
                    bool_to_i64(asset.is_active),
                    received_at
                ],
            )
            .map_err(write_error)?;
        if changed > 0 {
            updated += 1;
        }
    }

    transaction
        .execute(
            "UPDATE hyperliquid_account_snapshots SET is_current = 0 WHERE account_id = ?1",
            params![account_id],
        )
        .map_err(write_error)?;
    transaction
        .execute(
            "INSERT INTO hyperliquid_account_snapshots (
              id, account_id, account_value, total_margin_used, withdrawable, total_raw_usd,
              snapshot_timestamp, received_at, is_current
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1)",
            params![
                format!("hl_snapshot_{}", Uuid::new_v4()),
                account_id,
                data.account_snapshot.account_value,
                data.account_snapshot.total_margin_used,
                data.account_snapshot.withdrawable,
                data.account_snapshot.total_raw_usd,
                data.account_snapshot.snapshot_timestamp,
                received_at
            ],
        )
        .map_err(write_error)?;
    inserted += 1;

    transaction
        .execute(
            "UPDATE hyperliquid_position_snapshots SET is_current = 0 WHERE account_id = ?1",
            params![account_id],
        )
        .map_err(write_error)?;
    for position in data.positions {
        transaction
            .execute(
                "INSERT INTO hyperliquid_position_snapshots (
                  id, account_id, asset_key, symbol, side, signed_size, absolute_size, entry_price,
                  mark_price, notional, leverage_type, leverage_value, liquidation_price,
                  margin_used, unrealized_pnl, return_on_equity, snapshot_timestamp, received_at,
                  is_current
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, 1)",
                params![
                    format!("hl_position_{}", Uuid::new_v4()),
                    account_id,
                    position.asset_key,
                    position.symbol,
                    position.side,
                    position.signed_size,
                    position.absolute_size,
                    position.entry_price,
                    position.mark_price,
                    position.notional,
                    position.leverage_type,
                    position.leverage_value,
                    position.liquidation_price,
                    position.margin_used,
                    position.unrealized_pnl,
                    position.return_on_equity,
                    position.snapshot_timestamp,
                    received_at
                ],
            )
            .map_err(write_error)?;
        inserted += 1;
    }

    for fill in data.fills {
        let changed = transaction
            .execute(
                "INSERT OR IGNORE INTO hyperliquid_fills (
                  id, account_id, source_fill_identity, source_transaction_hash, source_order_id,
                  asset_key, symbol, side, direction, price, size, notional, fee, fee_token,
                  closed_pnl, fill_timestamp, received_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL, ?12, ?13, ?14, ?15, ?16)",
                params![
                    format!("hl_fill_{}", Uuid::new_v4()),
                    account_id,
                    fill.source_identity,
                    fill.source_transaction_hash,
                    fill.source_order_id,
                    fill.asset_key,
                    fill.symbol,
                    fill.side,
                    fill.direction,
                    fill.price,
                    fill.size,
                    fill.fee,
                    fill.fee_token,
                    fill.closed_pnl,
                    fill.fill_timestamp,
                    received_at
                ],
            )
            .map_err(write_error)?;
        if changed == 0 {
            unchanged += 1;
        } else {
            inserted += 1;
        }
    }

    for funding in data.funding {
        let changed = transaction
            .execute(
                "INSERT OR IGNORE INTO hyperliquid_funding (
                  id, account_id, source_funding_identity, asset_key, symbol, amount, funding_rate,
                  position_size, event_timestamp, received_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    format!("hl_funding_{}", Uuid::new_v4()),
                    account_id,
                    funding.source_identity,
                    funding.asset_key,
                    funding.symbol,
                    funding.amount,
                    funding.funding_rate,
                    funding.position_size,
                    funding.event_timestamp,
                    received_at
                ],
            )
            .map_err(write_error)?;
        if changed == 0 {
            unchanged += 1;
        } else {
            inserted += 1;
        }
    }

    transaction
        .execute(
            "UPDATE hyperliquid_open_order_snapshots SET is_current = 0 WHERE account_id = ?1",
            params![account_id],
        )
        .map_err(write_error)?;
    for order in data.open_orders {
        transaction
            .execute(
                "INSERT INTO hyperliquid_open_order_snapshots (
                  id, account_id, source_order_id, asset_key, symbol, side, order_type, price, size,
                  original_size, reduce_only, trigger_price, order_timestamp, snapshot_timestamp,
                  is_current
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1)",
                params![
                    format!("hl_order_{}", Uuid::new_v4()),
                    account_id,
                    order.source_order_id,
                    order.asset_key,
                    order.symbol,
                    order.side,
                    order.order_type,
                    order.price,
                    order.size,
                    order.original_size,
                    order.reduce_only.map(bool_to_i64),
                    order.trigger_price,
                    order.order_timestamp,
                    order.snapshot_timestamp,
                ],
            )
            .map_err(write_error)?;
        inserted += 1;
    }

    for resource in [
        "metadata",
        "account_state",
        "positions",
        "fills",
        "funding",
        "open_orders",
    ] {
        transaction
            .execute(
                "INSERT INTO integration_sync_state (
                  account_id, resource_kind, last_attempt_at, last_success_at, updated_at
                ) VALUES (?1, ?2, ?3, ?3, ?3)
                ON CONFLICT(account_id, resource_kind) DO UPDATE SET
                  last_attempt_at = excluded.last_attempt_at,
                  last_success_at = excluded.last_success_at,
                  updated_at = excluded.updated_at,
                  last_error_code = NULL",
                params![account_id, resource, received_at],
            )
            .map_err(write_error)?;
    }

    let completed = Utc::now().to_rfc3339();
    let resources_completed =
        r#"["metadata","account_state","positions","fills","funding","open_orders"]"#;
    transaction
        .execute(
            "UPDATE integration_sync_runs
             SET completed_at = ?1, status = 'completed', resources_completed_json = ?2,
                 records_inserted = ?3, records_updated = ?4, records_unchanged = ?5
             WHERE id = ?6",
            params![
                completed,
                resources_completed,
                inserted,
                updated,
                unchanged,
                run_id
            ],
        )
        .map_err(write_error)?;
    transaction
        .execute(
            "UPDATE integration_accounts
             SET status = 'active', last_sync_completed_at = ?1, last_sync_error_code = NULL,
                 last_successful_data_at = ?1, updated_at = ?1
             WHERE id = ?2",
            params![completed, account_id],
        )
        .map_err(write_error)?;
    transaction.commit().map_err(write_error)?;

    Ok(HyperliquidSyncResult {
        run_id,
        status: "completed".to_owned(),
        resources_completed: vec![
            "metadata".to_owned(),
            "account_state".to_owned(),
            "positions".to_owned(),
            "fills".to_owned(),
            "funding".to_owned(),
            "open_orders".to_owned(),
        ],
        error_code: None,
        records_inserted: inserted,
        records_updated: updated,
        records_unchanged: unchanged,
    })
}

pub fn fail_sync(
    connection: &Connection,
    account_id: &str,
    code: &str,
) -> Result<(), TradingError> {
    let now = Utc::now().to_rfc3339();
    connection
        .execute(
            "UPDATE integration_accounts
             SET status = 'error', last_sync_completed_at = ?1, last_sync_error_code = ?2, updated_at = ?1
             WHERE id = ?3",
            params![now, code, account_id],
        )
        .map_err(write_error)?;
    Ok(())
}

pub fn summary(
    connection: &Connection,
    account_id: &str,
) -> Result<HyperliquidAccountSummary, TradingError> {
    let account = get_account(connection, account_id)?;
    let snapshot = connection
        .query_row(
            "SELECT account_value, total_margin_used, withdrawable, snapshot_timestamp
             FROM hyperliquid_account_snapshots
             WHERE account_id = ?1 AND is_current = 1
             ORDER BY snapshot_timestamp DESC LIMIT 1",
            params![account_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()?;
    let (account_value, total_margin_used, withdrawable, last_snapshot_at) =
        snapshot.unwrap_or((None, None, None, String::new()));
    let last_snapshot_at = (!last_snapshot_at.is_empty()).then_some(last_snapshot_at);
    let open_position_count = count(
        connection,
        "SELECT COUNT(*) FROM hyperliquid_position_snapshots WHERE account_id = ?1 AND is_current = 1",
        account_id,
    )?;
    let fill_count = count(
        connection,
        "SELECT COUNT(*) FROM hyperliquid_fills WHERE account_id = ?1",
        account_id,
    )?;
    let funding_count = count(
        connection,
        "SELECT COUNT(*) FROM hyperliquid_funding WHERE account_id = ?1",
        account_id,
    )?;
    let open_order_count = count(
        connection,
        "SELECT COUNT(*) FROM hyperliquid_open_order_snapshots WHERE account_id = ?1 AND is_current = 1",
        account_id,
    )?;
    Ok(HyperliquidAccountSummary {
        freshness: freshness(account.last_successful_data_at.as_deref()),
        partial_sync: account.last_sync_error_code.is_some(),
        account,
        account_value,
        total_margin_used,
        withdrawable,
        open_position_count,
        fill_count,
        funding_count,
        open_order_count,
        last_snapshot_at,
        read_only: true,
    })
}

pub fn list_positions(
    connection: &Connection,
    account_id: &str,
) -> Result<Vec<HyperliquidPosition>, TradingError> {
    let mut statement = connection.prepare(
        "SELECT id, symbol, side, signed_size, absolute_size, entry_price, mark_price, notional,
         leverage_type, leverage_value, liquidation_price, margin_used, unrealized_pnl,
         return_on_equity, snapshot_timestamp
         FROM hyperliquid_position_snapshots
         WHERE account_id = ?1 AND is_current = 1
         ORDER BY symbol",
    )?;
    let rows = statement.query_map(params![account_id], |row| {
        Ok(HyperliquidPosition {
            id: row.get(0)?,
            symbol: row.get(1)?,
            side: row.get(2)?,
            signed_size: row.get(3)?,
            absolute_size: row.get(4)?,
            entry_price: row.get(5)?,
            mark_price: row.get(6)?,
            notional: row.get(7)?,
            leverage_type: row.get(8)?,
            leverage_value: row.get(9)?,
            liquidation_price: row.get(10)?,
            margin_used: row.get(11)?,
            unrealized_pnl: row.get(12)?,
            return_on_equity: row.get(13)?,
            snapshot_timestamp: row.get(14)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(TradingError::from)
}

pub fn list_fills(
    connection: &Connection,
    account_id: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<HyperliquidFill>, TradingError> {
    let limit = limit.clamp(1, MAX_LIST_LIMIT);
    let mut statement = connection.prepare(
        "SELECT id, symbol, side, direction, price, size, fee, fee_token, closed_pnl, fill_timestamp
         FROM hyperliquid_fills
         WHERE account_id = ?1
         ORDER BY fill_timestamp DESC
         LIMIT ?2 OFFSET ?3",
    )?;
    let rows = statement.query_map(params![account_id, limit, offset], |row| {
        Ok(HyperliquidFill {
            id: row.get(0)?,
            symbol: row.get(1)?,
            side: row.get(2)?,
            direction: row.get(3)?,
            price: row.get(4)?,
            size: row.get(5)?,
            fee: row.get(6)?,
            fee_token: row.get(7)?,
            closed_pnl: row.get(8)?,
            fill_timestamp: row.get(9)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(TradingError::from)
}

pub fn list_funding(
    connection: &Connection,
    account_id: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<HyperliquidFunding>, TradingError> {
    let limit = limit.clamp(1, MAX_LIST_LIMIT);
    let mut statement = connection.prepare(
        "SELECT id, symbol, amount, funding_rate, position_size, event_timestamp
         FROM hyperliquid_funding
         WHERE account_id = ?1
         ORDER BY event_timestamp DESC
         LIMIT ?2 OFFSET ?3",
    )?;
    let rows = statement.query_map(params![account_id, limit, offset], |row| {
        Ok(HyperliquidFunding {
            id: row.get(0)?,
            symbol: row.get(1)?,
            amount: row.get(2)?,
            funding_rate: row.get(3)?,
            position_size: row.get(4)?,
            event_timestamp: row.get(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(TradingError::from)
}

pub fn list_open_orders(
    connection: &Connection,
    account_id: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<HyperliquidOpenOrder>, TradingError> {
    let limit = limit.clamp(1, MAX_LIST_LIMIT);
    let mut statement = connection.prepare(
        "SELECT id, source_order_id, symbol, side, order_type, price, size, original_size,
         reduce_only, trigger_price, order_timestamp
         FROM hyperliquid_open_order_snapshots
         WHERE account_id = ?1 AND is_current = 1
         ORDER BY symbol, source_order_id
         LIMIT ?2 OFFSET ?3",
    )?;
    let rows = statement.query_map(params![account_id, limit, offset], |row| {
        let reduce_only = row.get::<_, Option<i64>>(8)?.map(|value| value == 1);
        Ok(HyperliquidOpenOrder {
            id: row.get(0)?,
            source_order_id: row.get(1)?,
            symbol: row.get(2)?,
            side: row.get(3)?,
            order_type: row.get(4)?,
            price: row.get(5)?,
            size: row.get(6)?,
            original_size: row.get(7)?,
            reduce_only,
            trigger_price: row.get(9)?,
            order_timestamp: row.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(TradingError::from)
}

pub fn diagnostics(connection: &Connection) -> Result<HyperliquidDiagnostics, TradingError> {
    Ok(HyperliquidDiagnostics {
        account_count: count_any(connection, "SELECT COUNT(*) FROM integration_accounts WHERE provider = 'hyperliquid'")?,
        fixture_account_count: count_any(connection, "SELECT COUNT(*) FROM integration_accounts WHERE provider = 'hyperliquid' AND is_fixture = 1")?,
        position_count: count_any(connection, "SELECT COUNT(*) FROM hyperliquid_position_snapshots")?,
        fill_count: count_any(connection, "SELECT COUNT(*) FROM hyperliquid_fills")?,
        funding_count: count_any(connection, "SELECT COUNT(*) FROM hyperliquid_funding")?,
        open_order_count: count_any(connection, "SELECT COUNT(*) FROM hyperliquid_open_order_snapshots")?,
        latest_sync_status: connection
            .query_row(
                "SELECT status FROM integration_sync_runs ORDER BY started_at DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()?,
    })
}

fn update_account_status(
    connection: &Connection,
    account_id: &str,
    status: IntegrationAccountStatus,
    sync_enabled: bool,
) -> Result<IntegrationAccount, TradingError> {
    let now = Utc::now().to_rfc3339();
    let changed = connection
        .execute(
            "UPDATE integration_accounts
             SET status = ?1, sync_enabled = ?2, updated_at = ?3
             WHERE id = ?4 AND provider = ?5",
            params![
                status.as_db(),
                bool_to_i64(sync_enabled),
                now,
                account_id,
                PROVIDER
            ],
        )
        .map_err(write_error)?;
    if changed == 0 {
        return Err(TradingError::account_not_found());
    }
    get_account(connection, account_id)
}

fn map_account(row: &rusqlite::Row<'_>) -> rusqlite::Result<IntegrationAccount> {
    let environment = match row.get::<_, String>(2)?.as_str() {
        "testnet" => HyperliquidEnvironment::Testnet,
        _ => HyperliquidEnvironment::Mainnet,
    };
    let normalized_address: String = row.get(4)?;
    Ok(IntegrationAccount {
        id: row.get(0)?,
        provider: row.get(1)?,
        environment,
        public_address: row.get(3)?,
        display_address: shorten_address(&normalized_address),
        normalized_address,
        display_name: row.get(5)?,
        status: IntegrationAccountStatus::from_db(row.get::<_, String>(6)?.as_str()),
        sync_enabled: row.get::<_, i64>(7)? == 1,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        last_sync_started_at: row.get(10)?,
        last_sync_completed_at: row.get(11)?,
        last_sync_error_code: row.get(12)?,
        last_successful_data_at: row.get(13)?,
        is_fixture: row.get::<_, i64>(14)? == 1,
    })
}

fn count(connection: &Connection, sql: &str, account_id: &str) -> Result<u32, TradingError> {
    connection
        .query_row(sql, params![account_id], |row| row.get::<_, i64>(0))
        .map(to_u32)
        .map_err(TradingError::from)
}

fn count_any(connection: &Connection, sql: &str) -> Result<u32, TradingError> {
    connection
        .query_row(sql, [], |row| row.get::<_, i64>(0))
        .map(to_u32)
        .map_err(TradingError::from)
}

fn to_u32(value: i64) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

fn freshness(last_successful_data_at: Option<&str>) -> super::models::TradingDataFreshness {
    let Some(value) = last_successful_data_at else {
        return super::models::TradingDataFreshness::Unknown;
    };
    let Ok(timestamp) = DateTime::parse_from_rfc3339(value) else {
        return super::models::TradingDataFreshness::Unknown;
    };
    let age_seconds = (Utc::now() - timestamp.with_timezone(&Utc))
        .num_seconds()
        .max(0);
    if age_seconds <= 300 {
        super::models::TradingDataFreshness::Fresh { age_seconds }
    } else if age_seconds <= 1800 {
        super::models::TradingDataFreshness::Aging { age_seconds }
    } else {
        super::models::TradingDataFreshness::Stale { age_seconds }
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn is_unique_error(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(failure, _)
            if failure.code == rusqlite::ErrorCode::ConstraintViolation
    )
}

fn write_error(error: rusqlite::Error) -> TradingError {
    TradingError::new(
        TradingErrorCode::DatabaseWriteFailed,
        "Trading Buddy could not save local trading data.",
        Some(error.to_string()),
        true,
    )
}

#[cfg(test)]
mod tests {
    use crate::storage::migrations::{configure_connection, run_migrations};

    use super::*;
    use crate::trading::fixtures::{fixture_sync_data, SYNTHETIC_FIXTURE_ADDRESS};

    fn database() -> Connection {
        let mut connection = Connection::open_in_memory().unwrap();
        configure_connection(&connection).unwrap();
        run_migrations(&mut connection).unwrap();
        connection
    }

    #[test]
    fn creates_account_and_rejects_duplicates() {
        let mut connection = database();
        let account = create_account(
            &mut connection,
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            Some("Fixture".to_owned()),
            true,
        )
        .unwrap();
        assert_eq!(account.environment, HyperliquidEnvironment::Testnet);
        assert!(create_account(
            &mut connection,
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            None,
            true,
        )
        .is_err());
    }

    #[test]
    fn sync_is_idempotent_for_fills_and_funding() {
        let mut connection = database();
        let account = create_account(
            &mut connection,
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            None,
            true,
        )
        .unwrap();
        let first = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            &account.normalized_address,
            "single_long",
        )
        .unwrap();
        persist_sync(&mut connection, &account.id, first).unwrap();
        let second = fixture_sync_data(
            HyperliquidEnvironment::Testnet,
            &account.normalized_address,
            "single_long",
        )
        .unwrap();
        let result = persist_sync(&mut connection, &account.id, second).unwrap();
        assert!(result.records_unchanged >= 2);
        assert_eq!(summary(&connection, &account.id).unwrap().fill_count, 1);
        assert_eq!(summary(&connection, &account.id).unwrap().funding_count, 1);
    }

    #[test]
    fn delete_local_data_leaves_non_trading_tables_alone() {
        let mut connection = database();
        let account = create_account(
            &mut connection,
            HyperliquidEnvironment::Testnet,
            SYNTHETIC_FIXTURE_ADDRESS,
            None,
            true,
        )
        .unwrap();
        delete_local_data(&mut connection, &account.id).unwrap();
        assert!(get_account(&connection, &account.id).is_err());
    }
}
