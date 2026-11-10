# Happy Farm

An original browser-based farming game inspired by classic social farming games. Happy Farm is in active early development, with a modular Phaser + TypeScript client now established alongside the original prototype.

**Play current prototype:** https://ums91.github.io/happy-farm/  
**Source:** https://github.com/ums91/happy-farm

## Product vision
A rich, persistent farming world with crop cycles, animals, production buildings, progression, land expansion, decoration and future social play. The project is being developed as a maintainable game codebase, not constrained to a single-file demo.

## Repository layout
- Root `index.html`: currently published prototype; retained during migration.
- `game/`: next-generation Phaser + TypeScript client, built with Vite.
- `docs/`: architecture, development and release documentation.
- `.github/workflows/`: manually triggered quality checks.

## Current engineering status
The modular client foundation includes a Phaser bootstrap, responsive game canvas, isometric tile-world rendering, original vector placeholder scenery, camera zoom/pan and an initial farm-tool interaction scaffold. It is not yet the production game and is not yet deployed to the public Pages URL.

To run the new client, see [game/README.md](game/README.md). The existing root-level prototype remains live until the new client is validated and the Pages deployment is deliberately switched.

## Documentation
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Release process](docs/RELEASE_PROCESS.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## GitHub Actions usage
Workflows are manual-only through `workflow_dispatch`. There are no push, pull-request or scheduled triggers. Run validation only when a meaningful checkpoint is ready to be checked.

## Versioning
Formal releases will follow [Semantic Versioning](https://semver.org/). The initial prototype is recorded as the 0.1.0 development baseline. The modular client currently identifies itself as 0.2.0 development work; neither is a stable public release. GitHub Releases will be published after reproducible builds and release checks are in place.

## Licensing
No open-source license is granted to this repository at this stage. Do not assume code or assets may be reused outside the project. Third-party content must have a compatible license and documented attribution before inclusion.
