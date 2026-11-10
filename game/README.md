# Happy Farm — Modular Game Client

This directory contains the Phaser + TypeScript game client that is being prepared to replace the original root-level prototype on GitHub Pages.

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
This is the first engine foundation: Phaser bootstrap, responsive canvas, isometric tile-world rendering, simple scenery, camera zoom/pan, initial tool interactions, local save/load for farm progress, and a decorative starter animal paddock. The classic social-farming UI refresh is in place. Vector-drawn scenery is temporary original placeholder art; production sprite assets, functional animal care and deeper farming systems are subsequent milestones.

The root index.html remains the published prototype until the new client is validated and the Pages deployment is deliberately switched.
