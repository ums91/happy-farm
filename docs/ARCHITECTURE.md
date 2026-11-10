# Architecture

## Current state
The default branch currently contains an early single-file browser prototype with a small crop loop and local browser persistence. It is a temporary baseline, not the target architecture.

## Target direction
A modular 2D game framework is planned. Phaser is the leading candidate, subject to technical validation; TypeScript will be used where it adds clear value.

Logical boundaries:
- Core: bootstrap, configuration, lifecycle and shared services.
- Scenes: boot, loading, farm, market and other game screens.
- World: tile map, layers, camera, terrain and object placement.
- Entities: crops, animals, buildings, decorations and interactables.
- Gameplay: farming, growth scheduling, inventory, economy, progression and quests.
- UI: HUD, menus, dialogs, shops and inventory.
- Content: data definitions for crops, animals, buildings, items and recipes.
- Persistence: versioned save schema, validation and migrations.
- Assets: spritesheets, tilesets, animations, fonts, audio and attribution metadata.

## Principles
1. Separate rendering from game rules so gameplay can be tested without a renderer.
2. Keep content data-driven rather than hard-coding each entity into scene logic.
3. Use stable identifiers for world objects and inventory items.
4. Version save files and provide explicit migrations.
5. Keep economy and progression rules deterministic and testable.
6. Track asset provenance and license.
7. Build a sound single-player foundation before networked features.

## Proposed runtime
Boot → preload assets → initialize services and save data → enter farm scene → process input and simulation → persist state.

## Open technical decisions
Final engine/version, tile dimensions and projection, state/event approach, save format and future backend requirements. Record material decisions as Architecture Decision Records.
