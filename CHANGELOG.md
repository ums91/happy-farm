# Changelog

Notable changes are documented here using the principles of Keep a Changelog.

## [Unreleased]

### Added
- Phaser 3 + TypeScript + Vite modular game client under game/.
- Responsive game shell with resource HUD, farm journal and tool palette.
- Isometric tile-world foundation with original vector placeholder scenery.
- Camera zoom/pan, plot selection and plow/plant/water/harvest interaction scaffold.
- Timed crop maturation and accelerated growth when watered.
- FarmVille 1-inspired visual refresh: bright sky-and-meadow palette, cream-and-wood framed HUD, rounded resource counters, farmer profile, progress meter and tactile farm-tool buttons.
- Richer isometric farm dressing with a fence line, flower patches, layered fruit-tree canopies, a starter animal paddock and more detailed mature crops.
- Versioned browser save/load for coins, experience and field states, with growing plots restored when the farm is reopened.
- Farm progress meter now reflects earned experience.
- Manual-only GitHub Pages deployment workflow for publishing the game client.

### Changed
- GitHub Actions workflows remain manual-only to avoid unnecessary usage.

### Notes
- The Pages deployment workflow has been committed but must be manually dispatched to publish the new client.
- Production sprite art, persistent saves, full inventory/economy and deeper gameplay systems remain future work.
- Build and browser validation must be completed before declaring a public release.

## [0.1.0] — Development baseline

### Added
- Initial browser-playable Happy Farm prototype.
- Basic farm grid and crop planting, watering and harvesting.
- Seed market, coins, experience and local browser save.

### Notes
- Prototype baseline only; not a stable production release.
