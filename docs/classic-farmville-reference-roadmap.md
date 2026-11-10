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

- Added a dedicated chicken coop and interactive dairy barn.
- Added animal housing capacity: 2 animals at level 1, with +2 capacity per upgrade, up to level 5.
- Added persistent building upgrade levels and capacity checks when purchasing animals.
- Animal care stores eggs and milk in dedicated produce inventory instead of immediately converting them into coins.
- Added produce selling: eggs sell for 12 coins and milk for 28 coins; sales also award XP.
- Added save schema v6 with backward-compatible loading for save versions 1–5.
- Added species-specific controls to collect produce or feed idle animals independently.
- Added live per-animal production progress and countdowns.
- Added produce storage limits (10 units at level 1, +5 per building level); full storage blocks collection without discarding ready products.
- Building upgrades increase both animal housing and produce storage.

## Phase 4 — Farm quests and milestone rewards (v1.2)

- Added six persistent farm quests covering first harvest, crop harvesting milestones, welcoming hens and cows, and upgrading the coop and silo.
- Quest progress is calculated from the player's saved farm state, so progress survives refreshes and earlier save versions.
- Added one-time claimable coin and XP rewards, with duplicate claims prevented by persisted quest IDs.
- Added a progress board in Inventory with completion state, reward details and progress bars.
- Added save schema v8 with backward-compatible migration; previous saves begin with the new quest board intact.

## Phase 3 — Animal management and silo storage (v1.1)

- Added individual animal assignment controls in the coop and dairy barn. Resting animals retain their housing space but do not consume feed or produce goods.
- Collection and feeding actions now operate only on assigned animals.
- Added persistent silo/warehouse upgrades, increasing both egg and milk storage by 10 spaces per level.
- Added save schema v7 with backward-compatible migration from earlier saves; existing animals remain assigned by default.
- Added silo upgrade controls to the inventory screen, with escalating coin costs.
- Next improvements: dedicated silo/building artwork, richer animal animations and production feedback, farm expansions, quests and ribbons.
