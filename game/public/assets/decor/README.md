# Happy Farm decoration assets

This directory contains the runtime decoration PNGs used by the farm scene.

## Manifest rules

- `manifest.json` lists only the 106 unique catalogue assets.
- Every manifest filename must exist in this directory and match its runtime asset ID (`<asset_id>.png`).
- Every asset ID and filename must be unique.
- Display names must describe the visible PNG artwork, including variants.
- Sheet-export aliases (such as `*_sheet1.png` and `*_sheet2.png`) that duplicate canonical PNGs are excluded from the catalogue manifest. They remain in the repository for backward compatibility and legacy asset resolution; do not delete them without checking save compatibility.
- Keep asset IDs stable. Renaming an ID can break decorations already stored in player farms.

## Adding a decoration

1. Add the final transparent PNG using a stable snake_case filename.
2. Add its ID to `DECOR_ASSET_ORDER` and a matching display name to `DECOR_DISPLAY_NAMES` in `game/src/scenes/FarmScene.ts`.
3. Add exactly one matching entry to `manifest.json`.
4. Confirm the Market thumbnail and placed decoration use the same asset ID and PNG.
