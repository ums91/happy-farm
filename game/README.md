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


## Supabase cloud saves

The game continues to save locally in `localStorage` under `happyFarmPhaserSaveV1`. When Supabase is configured and a player signs in, the same versioned farm JSON is synchronized to that player's private cloud row. Offline play continues locally; reconnecting retries synchronization. Signing out does not remove the local backup.

### Configure Supabase

1. Create a Supabase project.
2. Run [the cloud-save schema](../supabase/migrations/202611100001_farm_saves.sql) in the Supabase SQL Editor. It creates one save row per authenticated player and enables row-level security.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key. Never expose a secret/service-role key in browser code.
4. Run `npm install`, then `npm run build`.
5. For GitHub Pages, add Actions repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Settings → Secrets and variables → Actions → Variables).
6. Configure Supabase Auth → URL Configuration with the deployed GitHub Pages URL and enable email/password sign-in. If email confirmation is enabled, users must confirm before signing in.

### Sync behavior

- Saves are keyed by Supabase Auth user ID.
- On sign-in, a newer cloud save is restored; otherwise the local farm is uploaded.
- Existing game save calls still write locally first, then schedule a debounced cloud upsert.
- Offline or failed cloud operations do not block gameplay. Use **Sync now** after reconnecting.
- If a cloud save exists on a new device, it is restored. If no cloud row exists, the player's existing local farm is uploaded.

The root-level published prototype remains unchanged. These controls run in the Phaser client under `game/`; the Pages deployment must be switched to that client before players can use them.
