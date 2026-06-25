use super::errors::{TradingError, TradingErrorCode};

const MAX_DECIMAL_LENGTH: usize = 80;

pub fn validate_decimal_string(value: &str, field: &str) -> Result<String, TradingError> {
    if value.is_empty() || value.len() > MAX_DECIMAL_LENGTH || !value.is_ascii() {
        return Err(invalid_number(field, value));
    }
    if value.eq_ignore_ascii_case("nan") || value.eq_ignore_ascii_case("infinity") {
        return Err(invalid_number(field, value));
    }
    let body = value.strip_prefix('-').unwrap_or(value);
    if body.is_empty() || body.starts_with('+') || body.contains('e') || body.contains('E') {
        return Err(invalid_number(field, value));
    }
    let mut parts = body.split('.');
    let whole = parts.next().unwrap_or_default();
    let fractional = parts.next();
    if parts.next().is_some()
        || whole.is_empty()
        || !whole.chars().all(|char| char.is_ascii_digit())
    {
        return Err(invalid_number(field, value));
    }
    if let Some(fractional) = fractional {
        if fractional.is_empty() || !fractional.chars().all(|char| char.is_ascii_digit()) {
            return Err(invalid_number(field, value));
        }
    }
    Ok(value.to_owned())
}

pub fn validate_optional_decimal(
    value: Option<&str>,
    field: &str,
) -> Result<Option<String>, TradingError> {
    value
        .map(|value| validate_decimal_string(value, field))
        .transpose()
}

pub fn absolute_decimal(value: &str) -> String {
    value.strip_prefix('-').unwrap_or(value).to_owned()
}

pub fn decimal_side(value: &str) -> &'static str {
    if value.starts_with('-') && value != "-0" && value != "-0.0" {
        "short"
    } else if value
        .trim_start_matches('-')
        .trim_matches('0')
        .trim_matches('.')
        .is_empty()
    {
        "flat"
    } else {
        "long"
    }
}

fn invalid_number(field: &str, value: &str) -> TradingError {
    TradingError::new(
        TradingErrorCode::ProviderInvalidNumber,
        "Hyperliquid returned a number Trading Buddy could not read safely.",
        Some(format!("Invalid decimal for {field}: {value}")),
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_exact_decimal_text_without_rounding() {
        for value in [
            "0",
            "-0",
            "-1.25",
            "00012.3400",
            "999999999999999999999.000000000000000001",
            "0.000000000000000000000000001",
        ] {
            assert_eq!(validate_decimal_string(value, "x").unwrap(), value);
        }
    }

    #[test]
    fn rejects_malformed_decimal_text() {
        for value in [
            "", "+1", "1.", ".1", "1e-8", "NaN", "Infinity", "１.2", "1.2.3",
        ] {
            assert!(validate_decimal_string(value, "x").is_err(), "{value}");
        }
    }
}
