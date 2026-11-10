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
| Crop loop | Plow, buy seeds, plant, grow, harvest | Basic loop implemented; richer crop catalogue and mastery planned |
| Crop withering | Harvest window followed by withering | Planned |
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
