# FarmVille Asset Index — Animal and Tree Record Manifest

This file expands the user-supplied CDX excerpt into a searchable record-level inventory for the first asset-research pass. It contains metadata only: no image, SWF, extracted game data, or Zynga artwork is included.

**Rights gate:** these paths point to assets served from Zynga's FarmVille CDN. The index does not grant a license or permission to redistribute or reuse them. Keep this manifest as research metadata only. Do not add recovered assets to the Happy Farm build unless rights are independently cleared. Happy Farm production visuals remain the existing original assets or separately licensed/original replacements.

## Findings

- 58 animal/tree records are present in the supplied excerpt.
- `animals`: 37 records — 24 PNG and 13 SWF.
- `animalsnew`: 7 records — 3 PNG and 4 SWF.
- `trees`: 14 records — 11 PNG and 3 SWF.
- Combined: 41 PNG and 17 SWF.
- The 32-character CDN IDs are opaque. The index does not identify species, animation state, frame layout, dimensions, or whether a PNG is a complete sprite versus a cropped/partial element.
- SWF entries may contain vector animation/timelines, but the index alone cannot establish their contents.
- Consequently, species labels such as hen/cow/chicken cannot safely be assigned from filenames alone. Visual inspection requires the corresponding WARC payloads or an accessible archived response.

## Record manifest

Capture timestamps are shown as the 14-digit UTC values from the supplied CDX index. Offset and length are the index's recorded values; do not treat them as standalone download URLs.

| Category | CDN asset ID | Type | Capture (UTC) | Offset | Length (bytes) |
|---|---|---:|---:|---:|---:|
| animals | 049e7a1e2b55edb2c98ab818f7eda84e | PNG | 20201225045718 | 190428 | 190186 |
| animals | 0b8b8b0ef43795952dc4a760ef9e0f24 | PNG | 20201225045914 | 380614 | 190183 |
| animals | 126981fc3ebbf574834812be10cf5fb1 | SWF | 20201225050110 | 570797 | 190066 |
| animals | 194119d100f996e76451f49693b3529c | PNG | 20201225050305 | 760863 | 190189 |
| animals | 20263b518c81eed07719f035771a64d6 | PNG | 20201225050458 | 951052 | 189979 |
| animals | 2714874664e12db978202bd1209d3662 | PNG | 20201225050652 | 1141031 | 190009 |
| animals | 2e2f2286cc469d68c176a0308f99810d | PNG | 20201225050847 | 1331040 | 190085 |
| animals | 3513f7516ecf550d8ace99968d13eabe | PNG | 20201225051044 | 1521125 | 190092 |
| animals | 3be1d3d3f66388673ec96fa4857eb2b1 | PNG | 20201225051239 | 1711217 | 190169 |
| animals | 42de69f992ad1d58d8114fdbdabcd9a1 | PNG | 20201225051439 | 1901386 | 190216 |
| animals | 49e04f321b6dbfce8fa2f1fd1ed51ad8 | SWF | 20201225051637 | 2091602 | 190100 |
| animals | 50d29cd6b8fb399f7dda3ca2f78b3e17 | PNG | 20201225051838 | 2281702 | 190193 |
| animals | 5783b3a9df82c9ec36c8baf460c3e7f7 | PNG | 20201225052040 | 2471895 | 190106 |
| animals | 5e9e3f9e69e676f4be60b8eab0ea6d24 | SWF | 20201225052239 | 2662001 | 190041 |
| animals | 6574ff9d0110fe558f84cc1453629ce7 | SWF | 20201225052438 | 2852042 | 190015 |
| animals | 6c63ce0400c6f84b073ac36f21bc244e | PNG | 20201225052639 | 3042057 | 190106 |
| animals | 735b533fa24d0d75881eae52a5efe7d2 | SWF | 20201225052842 | 3232163 | 190129 |
| animals | 7a4e4da46a833105330d09e3e5f35845 | SWF | 20201225053047 | 3422292 | 190101 |
| animals | 812c8451f8b66482dc3a9090bb7b1c06 | PNG | 20201225053251 | 3612393 | 190045 |
| animals | 881319011500024496eee6019315942c | PNG | 20201225053456 | 3802438 | 190129 |
| animals | 8f296f5424d8f7faf2fcaa85b3ee6c9f | PNG | 20201225053658 | 3992567 | 190029 |
| animals | 9607321b8772953632fe48627a317864 | PNG | 20201225053902 | 4182596 | 190103 |
| animals | 9cfb057b5b6ff49cd5701f93c7008c46 | PNG | 20201225054105 | 4372699 | 190138 |
| animals | a406f4280fb252ce05481c4fea0a1db5 | PNG | 20201225054333 | 4562837 | 190212 |
| animals | ab290fbffeaa26fed3d4c1b7df3d55a8 | PNG | 20201225054537 | 4753049 | 190077 |
| animals | b2081ece63689a513e023581f2c0a0bc | PNG | 20201225054746 | 4943126 | 190092 |
| animals | b8f56023091d8ee0c22353d3b55357ab | SWF | 20201225054954 | 5133218 | 190196 |
| animals | c01d2bd0faf690f42fb32e655c5b7740 | PNG | 20201225055202 | 5323414 | 190112 |
| animals | c6f8a5007c9abb74a2cdc28b95b185d9 | SWF | 20201225055406 | 5513526 | 190211 |
| animals | ce035ea6dc25c0e2a6084eab15cbab65 | PNG | 20201225055611 | 5703737 | 190066 |
| animals | d4a50b37502c3a9c558e65061ca03a2d | PNG | 20201225055816 | 5893803 | 189953 |
| animals | db592f990a6c14eefd3b7b511757958b | PNG | 20201225060017 | 6083756 | 190915 |
| animals | e0bd821404ce9d8e4573bd46395fb7b1 | PNG | 20201225060155 | 6274671 | 190137 |
| animals | e778f51b0ba985aab72b17511a365e9a | PNG | 20201225060402 | 6464808 | 189969 |
| animals | ee5582da49e318ef8c120bcfc1ea41d7 | SWF | 20201225060600 | 6654777 | 190739 |
| animals | f4420346887d7c06158b2b858b5f37b0 | SWF | 20201225060800 | 6845516 | 189999 |
| animals | fb1cef2c1611c492a7ad1114c99c2194 | PNG | 20201225061002 | 7035515 | 190632 |
| animalsnew | 0b702e216082bf2c203430051b0cac32 | SWF | 20201225061203 | 7226147 | 191904 |
| animalsnew | 2f56cda1c71e511aa1525b648193a409 | SWF | 20201225061359 | 7418051 | 192048 |
| animalsnew | 5425892c5f67935fd837d8afa3c0ff7e | SWF | 20201225061556 | 7610099 | 192187 |
| animalsnew | 78bea25b2dfe3e32c71007871fe90ce4 | PNG | 20201225061754 | 7802286 | 191933 |
| animalsnew | 9e0fcd192b19b8e328d26cacf48f90fe | SWF | 20201225061947 | 7994219 | 192051 |
| animalsnew | c21944312b8db5369c0cae04acd749ca | PNG | 20201225062144 | 8186270 | 191907 |
| animalsnew | e636df5eec8a70fcfbe8f27496ed4ff5 | PNG | 20201225062343 | 8378177 | 192469 |
| trees | 0bc49f77b7b47e417bdab2de67601c05 | PNG | 20201225091327 | 22778869 | 191493 |
| trees | 1e728aaf8a9ba0f891af95b20f027bf9 | PNG | 20201225091532 | 22970362 | 191567 |
| trees | 30d9e8b4ae95e419cb09f6ecc0b452cc | PNG | 20201225091731 | 23161929 | 191493 |
| trees | 43d81f5531d3b448b0733cfd02d3a571 | PNG | 20201225091927 | 23353422 | 191500 |
| trees | 56f4c6cc5495fbc59e1dfef08668be91 | SWF | 20201225092123 | 23544922 | 191678 |
| trees | 69d2323bbdea6f13fb838278bc484b5e | PNG | 20201225092320 | 23736600 | 191542 |
| trees | 7cc4bd6da140d1e74ddc76880424af35 | PNG | 20201225092512 | 23928142 | 191657 |
| trees | 8f9a1438c58f507d95ec473085d8e4c7 | PNG | 20201225092706 | 24119799 | 191427 |
| trees | a20254707a822b7f3e9ffdf6584e4d24 | PNG | 20201225092859 | 24311226 | 191379 |
| trees | b4d234c6d8e0bf81e4087b2804aa34c7 | PNG | 20201225093056 | 24502605 | 192062 |
| trees | c65473df11908ab1781ef839e45a1b7c | PNG | 20201225093254 | 24694667 | 191522 |
| trees | d8d38dddab0198a69bb432596c64f068 | PNG | 20201225093450 | 24886189 | 191516 |
| trees | ebbae5e55abc7f871e988835619c7ce2 | SWF | 20201225093640 | 25077705 | 191445 |
| trees | fe6fe673e10470e46ed742b51665cde7 | SWF | 20201225093832 | 25269150 | 60157 |

## Next inspection gate

The source excerpt supplies metadata only. It does not supply the WARC response bodies, and the archive's WARC collection is multi-gigabyte. No bulk archive download is needed for this manifest. Before attempting individual payload recovery, validate the exact WARC-to-CDX mapping and whether the archive provides a supported single-record retrieval route. Even if inspection succeeds, use recovered files only in a temporary, non-production research workspace unless rights are cleared.

## Sources

- User-supplied CDX index excerpt, 2026-11-11.
- Farm Village preservation project's `assets.py`, which documents the Internet Archive item and WARC part names: https://github.com/AcidCaos/farmvillage/blob/main/assets.py. This is provenance information only, not an asset license.
- Happy Farm asset policy: [`game/public/assets/README.md`](../game/public/assets/README.md).
- Happy Farm reference/rights boundary: [`classic-farmville-reference-roadmap.md`](classic-farmville-reference-roadmap.md).
