# FarmVille Archived Asset Index — Research Catalogue

## Purpose and status

This catalogue records the supplied `original-farmville.cdx.gz` CDX index excerpt as a research reference for Happy Farm. It is an inventory of archived asset URLs and capture metadata, **not a collection of recovered image or animation files**.

**Reuse status: NOT CLEARED.** The paths identify assets served from Zynga's FarmVille CDN. The supplied index contains no creator declaration, license grant, permission, or redistribution terms. Do not download into the game bundle, commit, publish, crop, trace, or otherwise reuse the original artwork/SWFs unless rights are independently established. This follows the existing `game/public/assets/README.md` and `docs/classic-farmville-reference-roadmap.md` asset boundary.

## Index summary

- Source archive label: `original-farmville.cdx.gz`
- Capture date represented by records: 2020-12-25
- Records parsed: **132**
- File types: **94 PNG**, **34 SWF**, **4 JPG**
- CDX records expose a SURT-style URL key, timestamp, archive filename, compressed offset, and compressed length.
- The offsets/lengths refer to an external archive stream. The supplied Markdown excerpt does not include the WARC payload or archive download location, so it is insufficient to reconstruct the binaries by itself.

## Category inventory

| CDN path category | Records | Likely research relevance |
|---|---:|---|
| `animals` | 37 | Highest priority: animal appearance, poses and species variety |
| `animalsnew` | 7 | Newer animal assets and possible alternate animation sets |
| `trees` | 14 | Tree silhouettes, fruit-bearing stages and seasonal variety |
| `crops` | 4 | Crop growth-stage visual references |
| `buildings` | 10 | Barns, farm buildings and expansion visuals |
| `decorations` | 24 | Fences, props, mastery signs and scenery |
| `farmers_market` | 8 | Market icon/layout references |
| `dialogs` | 6 | Historical UI/dialog references |
| `missions` | 4 | Mission/quest visual references |
| `newsfeed` | 12 | Social/newsfeed visuals |
| `equipment` | 1 | Equipment/expansion reference |
| `fotd` | 1 | Feature-of-the-day image |
| `hud` | 1 | HUD icon |
| `mylife` | 1 | Profile/item image |
| `opt` | 1 | Optimized animal SWF |
| `opt_qa` | 1 | QA animal SWF |

## Happy Farm research priorities

1. **Animals (44 records across `animals` and `animalsnew`)** — use only as visual study material if access to the archive is later established; identify species, full-body framing, idle/eating/producing poses, and animation timing. Happy Farm's existing original animal artwork remains the production asset.
2. **Trees (14 records)** — study silhouette, canopy density, trunk scale, and fruit/no-fruit state progression. Implement any learned concepts with original art.
3. **Crops (4 records)** — compare planted, growing, ripe and harvested state presentation; create original crop sprites.
4. **Buildings (10 records)** — reference footprint, isometric proportions, entrances and readable silhouettes; create original building artwork.
5. **Decorations (24 records)** — use category names and layout ideas only; create original props and terrain dressing.

## Path and metadata interpretation

Each asset path follows the pattern:

`/farmville/assets/hashed/assets/<category>/<hash>.<extension>`

The 32-character filename stem is an opaque CDN asset identifier; it does not reveal the in-game item name. The timestamp is a capture timestamp in `YYYYMMDDhhmmss` form. The archive offsets are not direct web URLs and cannot be used without the matching archive file and its index format.

## Next steps / clearance gate

- Locate the matching WARC/archive collection and confirm that its terms permit access and any intended use.
- If recovered for inspection, keep binaries outside the production asset tree and do not commit them.
- Identify assets by visual inspection and map them to generic concepts (e.g. hen idle, cow eating, apple tree ripe) without copying proprietary artwork into Happy Farm.
- For production, use existing Happy Farm artwork or newly created/licensed assets with a recorded creator, source URL, license, attribution and modification history.
- Only after a rights review may any third-party asset be considered for inclusion.

## Source

User-supplied Markdown excerpt of the `original-farmville.cdx.gz` index, provided 2026-11-11. The excerpt contains 132 asset records. No WARC binary or licensing documentation was included.


## Matching archive collection located

The related FarmVille preservation repository identifies the matching Internet Archive collection:

- Collection: [original-farmville](https://archive.org/download/original-farmville/)
- WARC base URL: `https://archive.org/download/original-farmville/`
- The preservation project's `assets.py` lists four WARC parts named `urls-bluepload.unstable.life-farmvilleassets.txt-shallow-20201225-045045-5762m-00000.warc.gz` through `00003.warc.gz`, and extracts the `zynga1-a.akamaihd.net/farmville/assets/hashed/assets` path.
- The preservation project's README describes the complete archive payload as approximately 17 GB and says the minimal release downloads/extracts the WARC files on first launch.

Reference implementation: [Farm Village assets.py](https://github.com/AcidCaos/farmvillage/blob/main/assets.py). This is useful provenance and extraction documentation only; Happy Farm must not import its GPL code or treat its GPL license as a license for Zynga-originated assets.

**Retrieval decision:** the archive is now locatable, but no 17 GB WARC bundle has been downloaded into Happy Farm. The index alone is enough to map the 132 records, but not to decode their payloads. Any future inspection should happen in a separate temporary research workspace, not in `game/public/assets`, and production reuse remains blocked until rights are cleared.
