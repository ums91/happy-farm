# Happy Farm — Modular Game Client

This directory contains the next-generation Phaser + TypeScript client. It is intentionally isolated from the root-level prototype while the new build is developed and validated.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
```sh
cd game
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

## Validate and build
```sh
npm run typecheck
npm run build
npm run preview
```

Production output is written to game/dist. The Vite base path is configured for the repository's GitHub Pages URL.

## Current scope
This is the first engine foundation: Phaser bootstrap, responsive canvas, isometric tile-world rendering, simple scenery, camera zoom/pan and initial tool interactions. Vector-drawn scenery is temporary original placeholder art; production sprite assets and deeper farming systems are subsequent milestones.

The root index.html remains the published prototype until the new client is validated and the Pages deployment is deliberately switched.
