# Release Process

Happy Farm uses a release for every major, user-visible milestone. Each release must explain what changed and what players or testers should expect when upgrading.

## Versioning

Use MAJOR.MINOR.PATCH:
- MAJOR: incompatible save-data, architecture or gameplay changes that require a migration or reset.
- MINOR: major features, systems, content packs or substantial gameplay improvements that remain upgrade-compatible.
- PATCH: focused bug fixes, balance corrections and small polish updates.

During early development, use 0.y.z. Clearly label pre-1.0 releases as development/preview builds; save formats and gameplay may still change.

## What counts as a major change?

Create a new GitHub Release for each meaningful milestone, such as:
- A new gameplay system (animals, crafting, quests, expansion).
- A substantial UI, world-rendering or progression overhaul.
- A major economy, crop or inventory update.
- A save-data or technical architecture migration.
- A meaningful collection of improvements that changes the testing experience.

Small internal refactors and isolated minor fixes can be grouped into the next release rather than creating a release for every commit.

## Release workflow

1. Agree on the milestone scope and acceptance criteria.
2. Update `CHANGELOG.md` under `[Unreleased]` as work is completed.
3. At release time, move the relevant entries into a versioned changelog section.
4. Run TypeScript checks, production build and the available manual tests. Record exactly what passed; do not claim checks that were not run.
5. Test the release in GitHub Pages and review supported browsers/viewports.
6. Review save compatibility. State clearly whether existing progress is preserved, migrated, or reset; document any required player action.
7. Verify third-party asset licenses and attribution.
8. Create a version tag named `vX.Y.Z`.
9. Publish a GitHub Release from that tag with the upgrade notes template below.
10. Deploy the tested build to GitHub Pages using the manual-only deployment workflow, then verify the live version.

A GitHub Release is the milestone record; a deployment is a separate action. Do not describe a release as live until the Pages deployment has succeeded.

## Required GitHub Release notes

Every major release must include:

- **Version and release date**
- **Highlights:** short summary of the milestone.
- **Added:** new features, systems, content and controls.
- **Improved:** existing gameplay, performance, visuals, accessibility or usability.
- **Fixed:** notable bugs resolved.
- **Upgrade notes:** what changed for existing players and any steps they need to take.
- **Save compatibility:** preserved, migrated, reset, or not applicable.
- **Known issues:** important limitations testers should know.
- **Testing:** checks and browsers/devices actually tested.
- **Deployment:** whether the build is live on GitHub Pages, with the tested commit.

### Upgrade notes template

```markdown
## Happy Farm vX.Y.Z

### Highlights
- ...

### Added
- ...

### Improved
- ...

### Fixed
- ...

### Upgrade notes
- Existing farm progress: preserved / migrated / reset.
- Player action required: none / describe steps.

### Known issues
- ...

### Testing
- Build:
- Browser/device testing:

### Deployment
- GitHub Pages: deployed / not yet deployed.
- Commit:
```

## Release channels

- **Development:** ongoing work on the default branch.
- **Preview:** milestone builds for hands-on testing.
- **Stable:** tested, tagged releases. Before 1.0, releases should still be clearly marked as previews.

## GitHub Actions usage

All workflows remain manual-only to conserve Actions usage. Run validation and deployment only at deliberate checkpoints. Do not add push, pull-request or scheduled triggers without explicit approval.
