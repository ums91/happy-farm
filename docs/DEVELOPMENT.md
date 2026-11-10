# Development Guide

## Requirements
- Node.js 20 or newer
- npm

## Run the modular game client
```sh
cd game
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

## Validate and build
```sh
cd game
npm run typecheck
npm run build
npm run preview
```

The production build is written to `game/dist`. A package lockfile should be generated and committed as part of the first local dependency installation so future builds can use deterministic `npm ci`.

## Current implementation status
The new client includes Phaser bootstrap, responsive canvas, isometric tile-world rendering, vector placeholder scenery, camera zoom/pan and initial tool interactions. It does not yet include finished sprite art, timed crop growth, full inventory/economy, animals, persistence or online features.

The root-level `index.html` remains the published prototype until the modular client is validated and the Pages deployment is deliberately switched.

## GitHub Actions policy
All workflows are manually triggered using `workflow_dispatch`. They do not run on pushes, pull requests or schedules. Run the game validation workflow only at meaningful checkpoints to conserve Actions usage.

## Testing expectations
Gameplay changes should include tests for crop growth and harvest eligibility, inventory accounting, currency transactions, save validation/migrations and placement bounds. Visual changes should be checked at representative desktop and mobile viewport sizes.
