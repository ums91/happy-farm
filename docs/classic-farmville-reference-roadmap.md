# Happy Farm — classic FarmVille reference plan

Happy Farm is an independent educational recreation inspired by the classic FarmVille gameplay era. It uses original source code, original interface implementation and original artwork. It does not include Zynga source code, logos, or copied proprietary game assets.

## Reference material

The following community wiki pages inform the gameplay specification. Wiki page text is community-contributed and marked CC BY-SA unless a page says otherwise; any reused text must be attributed and shared under compatible terms. Images and third-party assets require separate rights checks.

- FarmVille overview: https://farmville.fandom.com/wiki/FarmVille
- Market categories: https://farmville.fandom.com/wiki/Market
- Seeds and crop lifecycle: https://farmville.fandom.com/wiki/Seed
- Withering: https://farmville.fandom.com/wiki/Wither
- Animals and animal storage: https://farmville.fandom.com/wiki/Animal
- Levels and unlocks: https://farmville.fandom.com/wiki/Level
- Buildings: https://farmville.fandom.com/wiki/Building
- Neighbours and gifting: https://farmville.fandom.com/wiki/Neighbor
- Ribbons: https://farmville.fandom.com/wiki/Ribbon
- Co-op jobs: https://farmville.fandom.com/wiki/Co-op_job

## Feature parity roadmap

| System | Classic reference behaviour | Happy Farm status |
|---|---|---|
| Isometric farm | Tile-based farm, initially 12×12 | Existing 13×11 playable field; resize/expansion planned |
| Crop loop | Plow, buy seeds, plant, grow, harvest | Expanded data-driven catalogue, level-gated seed market, growth stages and withering window implemented |
| Crop withering | Harvest window followed by withering | Implemented with persisted deadlines and plow-to-clear recovery |
| Market | Seeds, trees, animals, buildings, decorations, aides, clothes, expansions | Seeds, animals, feed, placeholder decorations; other tabs planned |
| Animals | Animals produce collectable goods; no slaughter mechanic | Hens and cows with feed and timed products implemented |
| Animal storage | Coops, barns and storage capacity | Planned |
| Progression | XP, levels and level-gated items | XP and level display; unlock gates planned |
| Quests and ribbons | Multi-step goals and achievement rewards | Planned |
| Social play | Neighbours, gifts and helping visits | Planned |
| Co-op | Timed cooperative farming jobs | Planned |
| Farm customization | Trees, buildings, fences and decorations | Basic scenery; placement/editing planned |

## Design principles

1. Prioritize the classic 2009–2013 FarmVille gameplay loop and readable, cheerful visual language.
2. Implement systems as original code and original assets; do not reuse proprietary Zynga files.
3. Keep save migrations backward-compatible whenever the save schema changes.
4. Treat wiki statistics as historical reference values, not mandatory balance values; tune Happy Farm's economy for a playable standalone game.
5. Ship in small verified increments. A release is complete only after typecheck, production build and GitHub Pages deployment succeed.

## Additional technical reference: Farm Village preservation project

Repository: https://github.com/AcidCaos/farmvillage  
License declared by repository: GNU General Public License v3.0 (GPL-3.0).  
Purpose: preservation and local play of the original FarmVille 1 Flash client, backed by a Python server.

### Reviewed architecture and useful behaviour references

- `engine.py`: world-object identity and mutation helpers; XP/level transitions; currency/item adjustments; time-aware crop/world calculations.
- `items.py`: data-driven item catalogue loaded from AMF and cached as JSON; item feature lookup.
- `player.py`: new-farm bootstrap, save loading and migration, neighbour discovery, player state.
- `quests.py`: quest definitions, task progression, prerequisite filtering and active quest slots.
- `storage.py`: inventory categories, item quantities, deposits/withdrawals, gift metadata.
- `commands.py`: authoritative gameplay actions and server-side validation, including farm interactions, purchases, harvests, feeding/social actions.
- `game_settings.py`: XP-to-level curves and farming/economy configuration.
- `version.py`: save-format migrations.
- `server.py`: Flask routes, local session handling and game protocol endpoints.

### How Happy Farm will use this reference

Happy Farm is a separate Phaser/TypeScript web game. The preservation project's Python server and Flash client are not being embedded or imported into this build. Instead, its documented/reverse-engineered behaviours guide independent implementations:

1. Use stable IDs for farm objects and make plot/object operations deterministic.
2. Move item catalogue, crop values, level thresholds and unlock requirements into data files rather than hard-coding every market card.
3. Create a versioned save migration layer and keep player, world, inventory and quest state separate.
4. Model quests as definitions plus prerequisite predicates, tracked actions, objective progress and rewards.
5. Use explicit inventory groups and validated quantity changes for seeds, feed, harvested products and gifts.
6. Keep the browser build client-authoritative for this standalone demo; introduce a server-authoritative API only when multiplayer or shared farms are implemented.

### Licensing and asset boundary

The preservation repository is GPL-3.0. This roadmap records it as a design/behaviour reference only. No Python source, SWF files, Flash client code, recovered binary game data, or FarmVille artwork has been copied into Happy Farm. If future implementation directly adapts GPL-covered code, Happy Farm's distribution and source-availability obligations must be reviewed and the derivative component must retain GPL-compatible licensing and notices. The preservation repository's README itself describes automatic downloads of large archived WARC/asset collections; ownership and provenance of each recovered game asset must be checked independently before any reuse. The repository's GPL notice does not, by itself, establish that Zynga-originated game assets are GPL-licensed.

## Phase 2 — Buildings and animal production (v1.0)

- Added a dedicated chicken coop and made the coop and dairy barn interactive from the farm scene.
- Added animal housing capacity: 2 animals at level 1, with +2 capacity per upgrade, up to level 5.
- Added persistent building upgrade levels and capacity checks when purchasing animals.
- Animal care now stores eggs and milk in a dedicated produce inventory instead of immediately converting them into coins.
- Added produce selling: eggs sell for 12 coins and milk for 28 coins; sales also award XP.
- Added save schema v6 with backward-compatible loading for save versions 1–5.
- Next improvements: dedicated building art, richer animal assignment and production feedback, storage capacity, and building-specific interactions.

## Phase 1 — Advanced crop system (v0.9)

- Expanded the data-driven seed catalogue to wheat, carrot, corn, strawberry, tomato, pumpkin, blueberry and watermelon.
- Added level gates for higher-tier seeds and XP awards per harvest.
- Added visible growth stages driven by persisted wall-clock deadlines.
- Added a harvest window after ripening; crops wither if left unharvested and can be cleared by plowing.
- Added save schema v5 with backward compatibility for save versions 1–4.
- Growth and withering are simulated locally in the browser; production values are short demo timings and can be balanced later.
