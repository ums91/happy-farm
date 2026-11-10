# Development Guide

## Current repository state
The current prototype is a standalone index.html and can be opened in a modern browser or served from a local static HTTP server. The modular engine migration has not yet been committed, so there is no supported npm build or test command at this baseline.

## Local prototype
1. Clone the repository.
2. Open index.html in a modern browser, or serve the repository root with a local static HTTP server.
3. Exercise planting, watering, growth, harvesting, selling and browser save persistence.

## Planned toolchain
The modular build will introduce a supported Node.js LTS version, pinned package manager and lockfile, reproducible development server and production build, formatting, linting, automated tests and a documented asset pipeline. Exact commands will be added with the build tooling; do not assume package scripts exist yet.

## Testing expectations
Gameplay changes should include tests for crop growth and harvest eligibility, inventory accounting, currency transactions, save validation/migrations and placement bounds. Visual changes should be checked at representative desktop and mobile viewport sizes.
