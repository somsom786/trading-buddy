use super::errors::{TradingError, TradingErrorCode};

pub fn normalize_hyperliquid_address(input: &str) -> Result<String, TradingError> {
    let trimmed = input.trim();
    if trimmed.len() != input.len() && trimmed.is_empty() {
        return Err(invalid_address("Address cannot be empty."));
    }
    if !trimmed.is_ascii() {
        return Err(invalid_address(
            "Address must use ASCII hexadecimal characters.",
        ));
    }
    if !trimmed.starts_with("0x") {
        return Err(invalid_address("Address must start with 0x."));
    }
    if trimmed.len() != 42 {
        return Err(invalid_address(
            "Address must be 42 characters including 0x.",
        ));
    }
    let hex = &trimmed[2..];
    if !hex.chars().all(|char| char.is_ascii_hexdigit()) {
        return Err(invalid_address(
            "Address contains non-hexadecimal characters.",
        ));
    }
    Ok(trimmed.to_ascii_lowercase())
}

pub fn shorten_address(address: &str) -> String {
    if address.len() == 42 {
        format!("{}…{}", &address[..6], &address[38..])
    } else {
        address.to_owned()
    }
}

fn invalid_address(detail: &str) -> TradingError {
    TradingError::new(
        TradingErrorCode::InvalidAddress,
        "Enter a valid public Hyperliquid address.",
        Some(detail.to_owned()),
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_valid_address_forms() {
        assert_eq!(
            normalize_hyperliquid_address(" 0xABCDEFabcdef1234567890000000000000000000 ").unwrap(),
            "0xabcdefabcdef1234567890000000000000000000"
        );
    }

    #[test]
    fn rejects_invalid_address_forms() {
        for value in [
            "abcdefabcdef1234567890000000000000000000",
            "0Xabcdefabcdef1234567890000000000000000000",
            "0xabc",
            "0xabcdefabcdef123456789000000000000000000000",
            "0xabcdefabcdef12345678900000000000000000zz",
            "０xabcdefabcdef1234567890000000000000000000",
        ] {
            assert!(normalize_hyperliquid_address(value).is_err(), "{value}");
        }
    }
}
