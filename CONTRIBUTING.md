# Contributing

Keep changes focused, reviewable and documented.

## Before starting
1. Review ROADMAP.md and existing issues.
2. Open an issue for substantial work, with expected behaviour and acceptance criteria.
3. Avoid bundling unrelated changes.

## Branches and commits
Use descriptive branches such as feature/crop-growth, fix/save-loading and docs/release-process. Prefer Conventional Commit messages:
- feat: add crop growth system
- fix: prevent harvesting immature crops
- docs: clarify local development setup
- refactor: separate inventory state
- test: cover crop growth calculations

## Pull requests
Explain motivation and implementation, link related issues, describe test commands and results, and include screenshots for visual changes. Call out save-data changes, performance implications and known limitations. Update documentation and CHANGELOG.md where appropriate.

## Code and assets
Prefer modular, typed and testable code. Keep content data-driven where practical. Never commit secrets or personal data. Only add original assets or assets with a compatible documented license; record source and attribution.

A change is complete only when its acceptance criteria are met, relevant tests pass and user-facing behaviour is documented.
