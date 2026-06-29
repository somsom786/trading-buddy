# Pet surface

The separate transparent pet window is implemented by the Hermes Desktop fork’s
`apps/desktop/src/app/pet-overlay` renderer and Electron main-process window. It shares the primary
renderer’s Hermes session rather than opening a second agent connection.
