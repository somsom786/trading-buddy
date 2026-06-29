# Reformed application (in progress)

Run the current vertical slice from the repository root:

```powershell
corepack pnpm next:dev
```

The launcher:

- builds the project-owned Petdex atlas;
- creates an isolated profile under `%LOCALAPPDATA%\TradingBuddy`;
- installs the bundled soul, safe skill, and pet without touching an existing Hermes home;
- pins ordinary Companion Safe Mode conversation to a no-tools policy;
- starts the Hermes backend and the branded Hermes Desktop fork;
- starts companion-first, with the full window hidden and the pet visible.

The first run installs the Hermes Python and desktop JavaScript dependencies and is therefore slower.
If a supported 8–9B Ollama model is already installed, the isolated profile selects it without
downloading anything. Otherwise provider setup remains explicit. No cloud fallback is configured.
The preserved Tauri application continues to run through the existing root commands until the
reformation reaches parity.
