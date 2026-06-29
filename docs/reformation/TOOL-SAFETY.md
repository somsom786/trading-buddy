# Tool Safety

Task 12 adds a dedicated Hermes toolset:

```text
trading-buddy-companion
```

The toolset intentionally contains no tools.

## Why no tools by default?

Trading Buddy is a crypto-trader companion. The default pet conversation path must not be able to:

- place, close, cancel, or modify trades;
- sign wallet transactions;
- read private keys or seed phrases;
- call arbitrary network integrations;
- inspect the desktop or browser;
- mutate files or execute commands;
- use model output as trusted financial state.

## Future tool criteria

Any future tool must be:

- local-first or explicitly user-approved;
- read-only before write-capable;
- narrow and typed;
- documented in `docs/DECISIONS.md`;
- tested at the boundary;
- hidden from default companion mode until product approval.
