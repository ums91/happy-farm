# ADR 0001: Select Phaser for the browser game client

- **Status:** Accepted for the initial client foundation
- **Date:** 2026-11-10
- **Decision owners:** Happy Farm project maintainers

## Context

Happy Farm is intended to become a substantial browser-based 2D farming game. The initial prototype is a single HTML file and is not a maintainable foundation for scenes, camera movement, world entities, animation, input, assets and future gameplay systems.

## Decision

Use Phaser 3 as the browser game framework, TypeScript for the game client and Vite for development and production builds.

## Rationale

- Phaser provides established 2D rendering, scene lifecycle, input, camera, animation and asset-loading primitives.
- TypeScript improves maintainability as the number of game systems and entities grows.
- Vite provides a lightweight local development server and static production build suitable for GitHub Pages.
- This combination supports an incremental migration while the current prototype remains available.

## Consequences

- The new client lives under game/ during the migration.
- A package lockfile must be committed before treating builds as reproducible.
- The current root-level prototype remains the published version until the new client passes validation and Pages deployment is deliberately switched.
- Game rules should be separated from Phaser rendering code so core logic can be tested independently.

## Revisit when

Revisit this decision if performance, platform requirements, multiplayer architecture or production tooling reveal limitations that materially affect the project.
