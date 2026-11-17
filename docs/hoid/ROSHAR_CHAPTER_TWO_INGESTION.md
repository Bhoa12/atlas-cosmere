# Roshar Chapter Two Ingestion

## Scope

This run inspected chapter-two XHTML documents from the three accessible private Roshar EPUBs. Only original editorial summaries, source locators and SHA-256 metadata are stored in the repository. No protected chapter prose or complete EPUB is uploaded.

The Library also listed additional entries with a "(1)" suffix and matching file sizes. The unsuffixed copies were used for inspection; the suffixed entries were not compared byte-for-byte and are not treated as independently verified editions.

## Inspected source documents

| Work ID | Local source file | Relative XHTML path | Document SHA-256 |
|---|---|---|---|
| `twok` | `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | `OEBPS/Text/L1-013.xhtml` | `5f76bd1de8106ebcba964f730368426fc22df1c2a7862e4f01dcf57ec0f63877` |
| `edgedancer` | `4 Danzante del Filo Brandon Sanderson.epub` | `OEBPS/Text/002.xhtml` | `397c116112ca87b77cdd2c324156349594f47660d332a10417884119c8e7b0a0` |
| `dawnshard` | `6 Esquirla del amanecer Brandon Sanderson.epub` | `OEBPS/Text/2.xhtml` | `511dd868f3feb65f3cc28566bbac167762ad70dddccffcae863be31e64f144dc` |

## Edition navigation identities

| Work ID | Edition ID | Navigation SHA-256 |
|---|---|---|
| `twok` | `roshar-omnibus-v1` | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` |
| `edgedancer` | `edgedancer-epub-v1` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` |
| `dawnshard` | `dawnshard-epub-v1` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` |

The relative locators are edition-bound and resolve respectively to `L1-013.xhtml`, `Text/002.xhtml` and `Text/2.xhtml`.

## Staged original summaries

Three original summaries were added to `src/hoid/editorialDrafts.ts`:

- `twok.chapter-002.kaladin-slave-caravan`
- `edgedancer.chapter-002.lift-yeddaw-arrival`
- `dawnshard.chapter-002.rysn-navani-akinah-mission`

Each draft is bound to the chapter-two document digest and has an unlock threshold at chapter three. All three remain `pending-review`; none is imported into the production editorial registry.

## Integrity and spoiler policy

- The chapter XHTML bytes were hashed locally after extraction from the private EPUBs.
- Summary hashes are SHA-256 over the exact UTF-8 original-summary strings.
- The source document hash is distinct from the EPUB navigation hash.
- A chapter-two summary is not available while chapter two is open; it becomes eligible only after the cursor advances beyond chapter two.
- Staging does not imply editorial approval or production availability.
- No raw chapter text, images, fonts or complete EPUB files were added to Git.

## Current source availability

The three Roshar EPUBs were accessible in the Library for this run. `cosmere.epub` was not present in the accessible Library listing, so no new Cosmere chapter bodies were inspected. The existing Cosmere catalogue and navigation metadata remain unchanged.
