# Pet Runtime

Task 12 uses a Petdex-compatible runtime for the Hermes vertical slice.

## Bundled pet

The default bundled pet is:

```text
next/pets/trading-buddy-default/
```

It contains:

- `pet.json`
- `spritesheet.png`
- `README.md`

The atlas is generated from project-owned temporary pose assets under `src/assets/buddy/poses`.

## Petdex dimensions

- Cell size: 192 by 208.
- Atlas size: 1536 by 1872.
- Layout: 8 columns by 9 rows.

Rows generated:

1. idle
2. running-right
3. running-left
4. waving
5. jumping
6. failed
7. waiting
8. running
9. review

## Runtime behavior

Hermes Desktop already provides a separate transparent always-on-top pet overlay. Task 12 adapts
that overlay rather than creating a second independent pet engine.

In companion mode:

- the pet is visible by default;
- the main window stays hidden until requested;
- clicking the pet opens the shared composer/bubble path;
- Bring Buddy Back restores the pet into the current monitor work area.
