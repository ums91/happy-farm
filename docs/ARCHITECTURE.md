# Architecture

## Current repository structure
- Root `index.html`: original browser prototype, retained as the currently published build during migration.
- `game/`: next-generation Phaser + TypeScript client using Vite.
- `game/src/scenes/`: Phaser scenes.
- `game/src/styles.css`: responsive shell and game interface.

## Engine decision
Phaser 3 is selected as the 2D game framework for the browser client. TypeScript provides static checking, and Vite provides the local development server and production bundler.

## Current implementation
The first scene establishes a responsive Phaser canvas, an isometric diamond-tile farm grid, simple orchard/building vector placeholders, camera zoom and pan, tile selection and initial plow/plant/water/harvest tool interactions. This is an engineering foundation, not finished gameplay. Art is placeholder vector artwork; persistence, timed crop growth, content systems and production sprites remain future work.

## Target logical boundaries
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
Tile dimensions and projection refinements, state/event approach, save format and future backend requirements. Record material decisions as Architecture Decision Records.
