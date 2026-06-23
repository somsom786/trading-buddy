use super::{errors::LocalAiError, models::OllamaChatChunk};

#[derive(Default)]
pub struct NdjsonStreamParser {
    buffer: Vec<u8>,
}

impl NdjsonStreamParser {
    pub fn push(&mut self, chunk: &[u8]) -> Vec<Result<OllamaChatChunk, LocalAiError>> {
        self.buffer.extend_from_slice(chunk);
        let mut records = Vec::new();

        while let Some(newline_index) = self.buffer.iter().position(|byte| *byte == b'\n') {
            let line = self.buffer.drain(..=newline_index).collect::<Vec<_>>();
            if let Some(record) = parse_line(&line[..line.len().saturating_sub(1)]) {
                records.push(record);
            }
        }
        records
    }

    pub fn finish(&mut self) -> Option<Result<OllamaChatChunk, LocalAiError>> {
        if self.buffer.is_empty() {
            return None;
        }
        let line = std::mem::take(&mut self.buffer);
        parse_line(&line)
    }
}

fn parse_line(line: &[u8]) -> Option<Result<OllamaChatChunk, LocalAiError>> {
    let trimmed = trim_ascii_whitespace(line);
    if trimmed.is_empty() {
        return None;
    }
    Some(
        serde_json::from_slice(trimmed).map_err(|error| LocalAiError::malformed(error.to_string())),
    )
}

fn trim_ascii_whitespace(mut value: &[u8]) -> &[u8] {
    while value.first().is_some_and(u8::is_ascii_whitespace) {
        value = &value[1..];
    }
    while value.last().is_some_and(u8::is_ascii_whitespace) {
        value = &value[..value.len() - 1];
    }
    value
}

#[cfg(test)]
mod tests {
    use super::NdjsonStreamParser;

    const CONTENT: &str = r#"{"message":{"content":"hello","thinking":""},"done":false}"#;
    const DONE: &str = r#"{"done":true,"eval_count":8,"total_duration":100}"#;

    #[test]
    fn buffers_partial_lines() {
        let mut parser = NdjsonStreamParser::default();
        assert!(parser.push(&CONTENT.as_bytes()[..20]).is_empty());
        let records = parser.push(&[&CONTENT.as_bytes()[20..], b"\n"].concat());
        assert_eq!(records.len(), 1);
        assert_eq!(
            records[0]
                .as_ref()
                .expect("record should parse")
                .message
                .as_ref()
                .expect("message should exist")
                .content,
            "hello"
        );
    }

    #[test]
    fn parses_multiple_records_and_blank_lines() {
        let mut parser = NdjsonStreamParser::default();
        let records = parser.push(format!("{CONTENT}\n\n{DONE}\n").as_bytes());
        assert_eq!(records.len(), 2);
        assert!(records[1].as_ref().expect("done should parse").done);
    }

    #[test]
    fn reports_malformed_records() {
        let mut parser = NdjsonStreamParser::default();
        let records = parser.push(b"{not-json}\n");
        assert!(records[0].is_err());
    }

    #[test]
    fn parses_final_record_without_newline() {
        let mut parser = NdjsonStreamParser::default();
        assert!(parser.push(DONE.as_bytes()).is_empty());
        assert!(
            parser
                .finish()
                .expect("record should remain")
                .expect("record should parse")
                .done
        );
    }
}
