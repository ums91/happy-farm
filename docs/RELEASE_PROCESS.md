# Release Process

## Semantic Versioning
Formal releases use MAJOR.MINOR.PATCH:
- MAJOR: incompatible save format, API or gameplay data changes.
- MINOR: backward-compatible features or content.
- PATCH: backward-compatible fixes.

During early development use 0.y.z. APIs and save formats are not guaranteed stable.

## Release checklist
1. Confirm milestone scope and acceptance criteria.
2. Update CHANGELOG.md and documentation.
3. Run formatting, lint, unit tests and production build when available.
4. Test the build in supported browsers and viewport sizes.
5. Review save compatibility and migrations.
6. Verify asset licenses and third-party notices.
7. Review critical bugs and known issues.
8. Create a version tag vX.Y.Z.
9. Publish GitHub Release notes with Added, Changed, Fixed and Known Issues.
10. Verify the deployed GitHub Pages build and record the release commit.

## Channels
- Development: ongoing changes on the default branch.
- Preview: milestone builds for testing.
- Stable: tested, tagged releases.

A release must identify its source commit and must not claim tests or deployment checks that were not run.
