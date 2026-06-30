# Hermes backend and Petdex compatibility work

The Trading Buddy frontend is the project-owned Tauri/React application in the repository root.
`next/agent` contains the `somsom786/hermes-agent` fork for agent/session backend integration work.
The Hermes Desktop renderer is not a product frontend and must not be presented as Trading Buddy.

Run the current product from the repository root:

```powershell
corepack pnpm desktop:dev
```

`corepack pnpm next:dev` is retained as a compatibility alias for the same Tauri application.

The legacy `next/scripts/dev.ps1` Hermes Desktop launcher remains only as historical integration
scaffolding while backend extraction is completed. Do not use it for product QA.

## Petdex compatibility verification

```powershell
corepack pnpm next:check
```

This builds and validates the project-owned offline Petdex-compatible pack. The product-owned
bubble can also request a small, validated selection from Petdex's documented read-only manifest
after the user explicitly opens the skin picker.
