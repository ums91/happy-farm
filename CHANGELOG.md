# Changelog

Notable changes are documented here using the principles of Keep a Changelog.

## [Unreleased]

### Added
- Phaser 3 + TypeScript + Vite modular game client under game/.
- Responsive game shell with resource HUD, farm journal and tool palette.
- Isometric tile-world foundation with original vector placeholder scenery.
- Camera zoom/pan, plot selection and plow/plant/water/harvest interaction scaffold.
- Timed crop maturation and accelerated growth when watered.
- Manually triggered game build/type-check and documentation workflows.

### Changed
- GitHub Actions workflows no longer run on every push or pull request; both are manual-only.
- Documentation now distinguishes the live prototype from the next-generation client.

### Notes
- The new client is not yet deployed to the public GitHub Pages URL.
- Production sprite art, persistent saves, full inventory/economy and deeper gameplay systems remain future work.
- A package lockfile and local build validation are still outstanding.

## [0.1.0] — Development baseline

### Added
- Initial browser-playable Happy Farm prototype.
- Basic farm grid and crop planting, watering and harvesting.
- Seed market, coins, experience and local browser save.

### Notes
- Prototype baseline only; not a stable production release.
- The current implementation will be replaced incrementally as the modular game foundation is introduced.
