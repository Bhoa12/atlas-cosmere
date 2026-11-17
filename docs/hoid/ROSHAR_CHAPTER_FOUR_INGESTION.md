# Roshar chapter-four ingestion

Date: 2026-11-17

## Scope

Three currently accessible private EPUBs were inspected locally. Duplicate Library copies were present; one canonical copy of each edition was used. The OPF/navigation metadata and the existing navigation digests were checked again before the chapter-body documents were read.

Only the chapter-four XHTML document from each edition was inspected. This record does not imply that later chapters, unlisted passages or other Cosmere works were inspected.

## Verified source documents

| Work ID | Edition | Chapter locator | Navigation SHA-256 | Chapter-document SHA-256 | Unlock |
|---|---|---|---|---|---|
| twok | roshar-omnibus-v1 | L1-016.xhtml | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 | 1a5d55dd8eaa304b14a10526e50a98826de139abbc402013150dd795f44bef89 | Chapter 5 |
| edgedancer | edgedancer-epub-v1 | Text/004.xhtml | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 | 4437c0e0ff5a617490a087d7c887117e63ff5f6f627d5e9f4515206fb77a3507 | Chapter 5 |
| dawnshard | dawnshard-epub-v1 | Text/4.xhtml | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 | a283662ad3c34e67db60ec847fd8c4166725361d166a507c95245141ecedfcdb | Chapter 5 |

The navigation hashes match the existing edition-bound locator registry. The chapter-four locators are already present in those manifests; no guessed path or new chapter numbering was introduced.

## Original summaries staged

- twok.chapter-004.kaladin-highstorm-camp
- edgedancer.chapter-004.lift-immigrant-district
- dawnshard.chapter-004.rysn-crew-trust

Each summary is original editorial prose with its own UTF-8 SHA-256 digest and an unlock threshold at chapter 5. The chapter currently open is not treated as completed: a reader must advance to chapter 6, or explicitly complete the work, before chapter-five completion can authorize these drafts.

All three drafts remain pending review. They are not imported into the approved production registry.

## Current verified-document inventory

- El camino de los reyes: chapters 1–4 (4 documents)
- Danzante del Filo: chapters 1–4 (4 documents)
- Esquirla del amanecer: chapters 1–4 (4 documents)
- El Imperio Final: chapters 1–2 (2 documents)

Total: 14 individually inspected chapter documents. This is a sparse allowlist, not a claim that all other chapters have been inspected.

## Copyright and availability boundary

No EPUB bytes, XHTML bodies, extracted passages or chapter text are committed. The repository contains only edition metadata, relative locators, SHA-256 digests and original summaries.

The current Library listing exposes the three Roshar EPUBs (with duplicate copies) but does not expose cosmere.epub. No new El Imperio Final chapter was inspected during this run.
