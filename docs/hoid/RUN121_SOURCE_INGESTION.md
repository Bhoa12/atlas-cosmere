# Hoid Run 121 — source ingestion record

## Source availability

The current Library copy of `cosmere.epub` was materialized for local inspection. Its `EPUB/nav.xhtml` SHA-256 remains `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee`.

The existing TFE chapter-one and chapter-two document hashes were recomputed from the current EPUB and matched the previously registered values. The chapter-three href was checked in the NCX, OPF manifest and spine before the XHTML bytes were hashed.

## Newly inspected documents

| Work | Chapter | EPUB locator | Document SHA-256 | Unlock threshold |
|---|---:|---|---|---:|
| El Imperio Final (`tfe`) | 3 | `books/b000001/OEBPS/Text/003.xhtml` | `bdbdd338d35c37d455c542384b51c4d67e7e46c1e4d2a5bf6d1535e02c4808c7` | 4 |
| Danzante del Filo (`edgedancer`) | 8 | `Text/008.xhtml` | `3b6e7ed84bcd4b08908f0f022edfc127b2dca223d834dc8841359fcb3ecbe095` | 9 |
| Esquirla del amanecer (`dawnshard`) | 8 | `Text/8.xhtml` | `04cf11bf2784a7cc8b01cc226cb403744860f72cf8715bc8c2724f1e2c860a25` | 9 |

The Edgedancer and Dawnshard navigation/NCX digests were rechecked against their registered edition values. Each chapter-eight href was confirmed in the navigation document, OPF manifest and spine before its document hash was accepted.

## Original summaries

Three original Spanish summaries were added to the editorial staging set:

- `tfe.chapter-003.vin-kelsier`
- `edgedancer.chapter-008.lift-follows-darkness`
- `dawnshard.chapter-008.rysn-dead-santhid`

Each summary has its own SHA-256 digest and remains `pending-review`. TFE chapter three requires completion through chapter four; the two chapter-eight summaries require completion through chapter nine. Opening the threshold chapter does not count as completing it.

## Identity reference closure

The existing atomic claim `tfe.vin.ability.emotional-allomancy` referenced subject ID `tfe.vin`, which previously had no matching identity dossier. Two dossiers have now been staged:

- `tfe.vin`, backed by the already verified TFE chapter-one document;
- `tfe.kelsier`, backed by the already verified TFE chapter-two document.

The current EPUB's chapter-one and chapter-two hashes matched the existing allowlist. The dossiers contain canonical labels only: no aliases and no first-appearance assertions. Both remain pending review.

## Bundle result and remaining gates

The complete editorial bundle now inventories 26 summaries, one atomic claim, 14 identity dossiers and three relationship claims across 26 distinct edition-bound source documents. Its status is `ready-for-review` with no cross-reference blockers.

This does not approve any record. The separate promotion planner remains blocked by the unresolved Edgedancer participant and the absence of independent review receipts. Production registries and the authorized knowledge graph remain unchanged.

The current Library listing did not expose the El camino de los reyes EPUB. Chapter eight of `twok` was therefore not inspected or added to the allowlist in this run.

## Copyright and repository hygiene

No EPUB, XHTML body, extracted text, source image or protected passage is committed. The repository receives only source metadata, opaque locators, document digests, original summaries and tests.
