# Run 165 — Source coverage and evidence completeness

## Purpose

This audit makes the difference between catalogue presence, edition structure, navigation locators, individually inspected chapter documents, editorial staging and production knowledge explicit.

It is a metadata-only report. It is not a knowledge retrieval API, does not authorize a claim, and must never be used to unlock a chapter. `HoidEvidenceRuntime` and the existing per-work progress checks remain the only narrative authorization boundary.

## Current inventory

The checked-in catalogue contains 24 works: 17 assigned to `cosmere.epub` and 7 assigned to the Roshar EPUB sources.

| Coverage layer | Current inventory | What it proves |
|---|---:|---|
| Bibliography entries | 24 | Work identity and source group are catalogued |
| Edition structures | 24 | A conservative progress policy is recorded for every catalogue work |
| Verified numbered-chapter locators | 1,106 | Relative navigation hrefs are bound to an edition and navigation digest |
| Works with at least one verified locator | 20 | Navigation metadata exists for those work IDs |
| Individually inspected chapter documents | 35 | Exact XHTML document bytes were inspected and fingerprinted |
| Works with inspected chapter documents | 4 | Body-level inspection is limited to those four works |
| Original staged chapter summaries | 35 | Original editorial summaries exist in staging |
| Summaries pending review | 35 | None of those summaries is approved for production |
| Production knowledge entries | 0 | No narrative knowledge entry is active |
| Approved production claims | 0 | No claim can currently be served as verified narrative knowledge |

The 1,106 locators comprise 653 Cosmere locators and 453 Roshar locators. A locator verifies a navigation target only. It does not prove that the corresponding chapter body has been inspected.

## Per-work inventory

Counts are: verified navigation locators / individually inspected chapter documents / staged summaries.

### `cosmere.epub`

| Work ID | Work | Locators | Inspected bodies | Staged summaries | Progress limitation |
|---|---|---:|---:|---:|---|
| `tfe` | El Imperio Final | 38 | 3 | 3 | Numeric chapters |
| `woa` | El Pozo de la Ascensión | 59 | 0 | 0 | Numeric chapters |
| `hoa` | El Héroe de las Eras | 82 | 0 | 0 | Numeric chapters |
| `aol` | Aleación de ley | 20 | 0 | 0 | Numeric chapters |
| `sos` | Sombras de identidad | 26 | 0 | 0 | Numeric chapters |
| `bom` | Brazales de Duelo | 31 | 0 | 0 | Numeric chapters |
| `tlm` | El metal perdido | 74 | 0 | 0 | Numeric chapters |
| `warbreaker` | El aliento de los dioses | 58 | 0 | 0 | Numeric chapters |
| `elantris` | Elantris | 47 | 0 | 0 | Only the unambiguous numeric prefix 1–47 is enabled; 48, 51 and 57 have duplicate locators |
| `white-sand-1` | Arena blanca vol. 1 | 0 | 0 | 0 | Volume segmentation required |
| `white-sand-2` | Arena blanca vol. 2 | 0 | 0 | 0 | Volume segmentation required |
| `white-sand-3` | Arena blanca vol. 3 | 0 | 0 | 0 | Volume segmentation required |
| `tress` | Trenza del mar Esmeralda | 64 | 0 | 0 | Numeric chapters |
| `yumi` | Yumi y el pintor de pesadillas | 41 | 0 | 0 | Numeric chapters |
| `sunlit` | El Hombre Iluminado | 52 | 0 | 0 | Numeric chapters |
| `isles` | Islas de la ascuaoscura | 61 | 0 | 0 | Numeric chapters |
| `arcanum` | Arcanum ilimitado | 0 | 0 | 0 | Collection sections need independent cursors |

### Roshar EPUBs

| Work ID | Work | Locators | Inspected bodies | Staged summaries | Progress limitation |
|---|---|---:|---:|---:|---|
| `twok` | El Camino de los Reyes | 75 | 10 | 10 | Numeric chapters |
| `wor` | Palabras radiantes | 89 | 0 | 0 | Numeric chapters |
| `ob` | Juramentada | 122 | 0 | 0 | Numeric chapters |
| `row` | El Ritmo de la Guerra | 117 | 0 | 0 | Numeric chapters |
| `sawt` | Viento y Verdad | 11 | 0 | 0 | Only the safe numeric prefix through chapter 11 is locator-backed; chapter numbers 12 and 14 are ambiguous |
| `edgedancer` | Danzante del Filo | 20 | 11 | 11 | Numeric chapters |
| `dawnshard` | Esquirla del amanecer | 19 | 11 | 11 | Numeric chapters |

## Interpretation rules

1. **Catalogue entry is not source access.** A bibliography record identifies a supplied work; it does not prove that any passage was read.
2. **Edition structure is not navigation coverage.** Chapter counts are derived from the recorded edition structure and exclude unmodelled front/back matter and special sections.
3. **Navigation locator is not body inspection.** A TOC href plus navigation digest proves only that the target is represented in the inspected navigation document.
4. **Body inspection is sparse and exact.** A chapter counts as inspected only when its exact XHTML bytes have an edition-bound locator and an allowlisted SHA-256 digest.
5. **Staging is not approval.** All 35 summaries remain `pending-review`. The 53-record editorial bundle being `ready-for-review` means its cross-references are structurally complete, not that any record has been approved.
6. **Production remains empty.** The knowledge registry, approved-claim registry and topic-assignment activation receipt remain empty/null.
7. **Ambiguity remains blocked.** Elantris, Viento y Verdad, Arena blanca and Arcanum ilimitado retain their conservative progress policies. This report does not infer missing locators or section boundaries.
8. **No cross-book unlock.** A verified chapter or cursor in one work never authorizes evidence from another work.

## Implementation

- `src/hoid/sourceCoverage.ts` builds the immutable report from the checked-in bibliography, edition policies, reading manifests, sparse navigation/document allowlists, staging drafts and production registry.
- `src/hoid/verifiedChapterDocuments.ts` exposes the sorted chapter numbers whose original XHTML bytes were individually inspected. It exposes no prose or hashes through the coverage report.
- `src/hoid/sourceCoverage.test.ts` asserts the 24-work inventory, 1,106 locators, 35 inspected documents, 35 pending summaries, ambiguous/segmented policies and empty production registries.
- `hoid-source-coverage-audit.yml` runs the coverage and source-boundary regressions with strict TypeScript checks.

## Scope of this run

Run 165 materialized the three unique Roshar EPUBs currently present in the Library and inspected only these chapter-body targets:

- El Camino de los Reyes, chapters 9–10 — OEBPS/Text/L1-023.xhtml and OEBPS/Text/L1-024.xhtml;
- Danzante del Filo, chapters 10–11 — OEBPS/Text/010.xhtml and OEBPS/Text/011.xhtml;
- Esquirla del amanecer, chapters 10–11 — OEBPS/Text/10.xhtml and OEBPS/Text/11.xhtml.

For each source, the navigation-document digest matched the edition-bound value already recorded in the repository. Each target was confirmed in the EPUB OPF manifest and spine before its exact XHTML bytes were SHA-256 fingerprinted. Six original Spanish summaries were added to staging with the next-chapter unlock boundary. All remain pending review.

The current Library listing did not include cosmere.epub, so no new Cosmere chapter was inspected in this run. The existing Cosmere catalogue and navigation metadata remain structural records only.

No EPUB, XHTML body, copied passage, image, extracted text or private device URI is committed. The report contains work metadata, counts and chapter numbers only.
