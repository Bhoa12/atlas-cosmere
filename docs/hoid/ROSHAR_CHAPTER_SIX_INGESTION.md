# Roshar chapter-six ingestion

## Scope

Run 119 inspected chapter six in each of the three private Roshar EPUBs currently accessible in the Library. The raw EPUBs were materialized locally for inspection only. No EPUB, XHTML body, extracted passage or image was added to the repository.

## Edition-bound source records

| Work | Edition | Chapter document | Chapter-body SHA-256 |
|---|---|---|---|
| El camino de los reyes | `roshar-omnibus-v1` | `OEBPS/Text/L1-019.xhtml` | `9af4c12b07013a211fa399d6b53061c9207cfd49c42c56d89ded8cdc68c9c1c2` |
| Danzante del Filo | `edgedancer-epub-v1` | `OEBPS/Text/006.xhtml` | `b911d60b2e2630d79e6659a441ce4210e228b11c47ad6f9f026a9ce6b3c48de2` |
| Esquirla del amanecer | `dawnshard-epub-v1` | `OEBPS/Text/6.xhtml` | `4025cf190a6b7d6e17d66036705f6aa1f16f3194b3964a29ea4aa77249a3bc3b` |

The exact relative hrefs were resolved from each EPUB navigation document and matched to the already registered edition/navigation digests:

- `twok`: `roshar-omnibus-v1`, navigation SHA-256 `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`.
- `edgedancer`: `edgedancer-epub-v1`, navigation SHA-256 `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`.
- `dawnshard`: `dawnshard-epub-v1`, navigation SHA-256 `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075`.

The sparse document allowlist now contains chapters one through six for these three works. This does not imply that later chapter bodies have been inspected.

## Original editorial summaries

Three original Spanish summaries were added to `editorialDrafts.ts`:

- `twok.chapter-006.kaladin-bridge-four`
- `edgedancer.chapter-006.lift-tashikk-orphanage`
- `dawnshard.chapter-006.rysn-worm-grain-trade`

Each summary is bound to its own edition, chapter locator, source-document digest and UTF-8 summary digest. Each remains `pending-review`.

## Spoiler thresholds

Every chapter-six summary requires completion through chapter seven of its own work. Opening chapter seven satisfies the threshold because the cursor-native boundary authorizes through chapter six; opening chapter six does not. Progress in another work cannot unlock these summaries.

## Current staging inventory

- 20 original summaries in staging.
- 20 individually inspected chapter-body documents.
- 0 approved summaries.
- 0 new production claims or aliases.
- 0 production graph writes.

The inventory consists of chapters one through six for the three Roshar works and chapters one and two of El Imperio Final.

## Source availability

The current EPUB-filtered Library listing exposed the three Roshar EPUBs (with duplicate copies) but did not expose `cosmere.epub`. No new Mistborn or other Cosmere chapter body was inspected. The two previously verified El Imperio Final chapter documents remain unchanged.

## Copyright boundary

The repository contains only source identifiers, edition metadata, relative locators, SHA-256 digests and original summaries. It contains no EPUB bytes, XHTML body text, copied passages or source images.
