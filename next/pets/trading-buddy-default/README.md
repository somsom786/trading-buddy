# Trading Buddy default pet

This is a static Petdex-compatible package built only from the project-owned poses in
`src/assets/buddy/poses/`.

Run `pnpm next:pet:build` after changing the source poses. The generated atlas uses the current
Petdex 192×208 cell, 8-column, 9-row layout. Pet packs are data only: scripts, hooks, and executable
metadata are rejected by the local adapter.
