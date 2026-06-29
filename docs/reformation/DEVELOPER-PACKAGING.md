# Developer Packaging

Task 12 keeps the Hermes/Petdex reformation as a developer preview, not a signed production
installer.

## Repeatable local build

From the repository root:

```powershell
corepack pnpm next:check
npm run build --workspace apps/desktop --prefix next/agent
```

From `next/agent`:

```powershell
npm run fmt --workspace apps/desktop
npm run lint --workspace apps/desktop
npm run typecheck --workspace apps/desktop
npm run build --workspace apps/desktop
```

## Unpacked desktop package

After committing local changes, create an unpacked developer package from `next/agent`:

```powershell
npm run pack --workspace apps/desktop
```

Expected output:

```text
next/agent/apps/desktop/release/<platform>-unpacked/
```

On Windows, the expected executable is:

```text
next/agent/apps/desktop/release/win-unpacked/Trading Buddy.exe
```

## Production packaging status

Production installer signing, update channels, migration prompts, and release artifacts are still
out of scope for Task 12. The packaging target for this task is a repeatable local developer build
and unpacked package.

## Current caveats

- The desktop bundle currently emits a large-chunk warning.
- The generated CSS optimizer reports one existing warning around `.btn-arc` text.
- Build stamps should be generated from a clean committed tree before publishing any artifact.
