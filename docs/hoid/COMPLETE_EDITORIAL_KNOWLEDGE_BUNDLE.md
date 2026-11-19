# Hoid complete editorial knowledge bundle

Run 121 closes the atomic-claim subject reference for `tfe.vin` using a separate identity dossier backed by the previously verified chapter-one source document. Run 124 adds three more original chapter summaries after inspecting the current Roshar EPUB copies.

## Current staging inventory

The deterministic metadata-only manifest now contains:

- 39 original chapter summaries;
- 1 atomic claim;
- 14 entity identity dossiers;
- 3 relationship claims;
- 35 distinct edition-bound source documents.

All four source batches are revalidated before inclusion. The Vin dossier uses the existing chapter-one TFE document digest; the Kelsier dossier uses the existing chapter-two digest. Both dossiers remain pending review and do not declare aliases or first-appearance claims.

The manifest status is now `ready-for-review`, with no cross-reference blockers. This status means only that the inventory and its identity references are internally complete. It does not mean any record has been approved.

## Manifest contents and exclusions

The manifest contains only category and stable record IDs, per-record SHA-256 digests, exact edition-bound source metadata, independent unlock thresholds, deterministic cross-reference blockers and one fingerprint for the complete manifest. It does not contain summary prose, claim statements, EPUB passages, XHTML bodies, extracted text or images.

## Cross-reference rules

- Every atomic claim subject must have an entity dossier with the same stable ID and knowledge kind.
- Both participants of every relationship must have entity dossiers with matching IDs and kinds.
- A missing or mismatched identity blocks the bundle. It is never repaired by fuzzy matching or inferred from a summary title.
- Source records are deduplicated by their complete edition-bound evidence scope, including unlock threshold.

The TFE atomic claim subject now resolves to the `tfe.vin` dossier. The Roshar relationship participants continue to resolve to matching identity dossiers.

## Review and production

Every record remains pending editorial review. The bundle builder always returns `promotionAllowed: false` and `productionWritePerformed: false`.

The entity/relationship promotion planner remains separately blocked by the unresolved Edgedancer participant and the absence of independent review receipts. The bundle's `ready-for-review` status must never be interpreted as approval or permission to write production knowledge.

The protected promotion authority still requires a trusted source-control adapter, an authoritative live-progress adapter and a maintainer-controlled change. No production registry, alias registry or graph edge is modified by this module.

## Revalidation

`validateHoidEditorialKnowledgeBundleManifest(manifest, sourceInput)` rebuilds the bundle from the exact four source batches and compares the canonical manifest and fingerprint. A changed source batch, record digest, source locator, unlock threshold, cross-reference or ordering invalidates the prior manifest.

## Tests

`editorialKnowledgeBundle.test.ts` covers deterministic inventory, exact category counts, missing claim subjects, relationship participant links, manifest tampering, changed source inventories, sparse/accessor-backed input, prose exclusion and unexpected fields.


## Run 124 — source-backed Roshar expansion

The current Library copies were rechecked. The eighth numbered chapter in the Roshar omnibus (`twok`) and the ninth numbered chapters in `edgedancer` and `dawnshard` were located in their exact TOCs, matched to OPF manifest entries and confirmed in the spine before hashing. Their document digests are recorded in `verifiedChapterDocuments.ts`.

The staging manifest now contains 57 records across 39 distinct chapter-body documents: 39 summaries, one atomic claim, 14 identity dossiers and three relationship claims. Its status remains `ready-for-review`; no summary or dossier is approved by this structural status.

The chapter-eight summary unlocks when its reader cursor advances to chapter nine (completed-through watermark eight). The three chapter-nine summaries unlock when their respective cursors advance to chapter ten (watermark nine). The three chapter-ten summaries unlock at cursor eleven (watermark ten), and the two chapter-eleven summaries at cursor twelve (watermark eleven). All nine remain pending review and are excluded from the production registry.

See `docs/hoid/ROSHAR_CHAPTER_NINE_INGESTION.md` for exact edition IDs, navigation digests, relative locators and document digests. No EPUB bytes, XHTML bodies or source passages were committed.


## Run 165 — chapter-nine and chapter-ten Roshar expansion

The current Library listing contained the Roshar omnibus, Danzante del Filo and Esquirla del amanecer EPUBs. Their existing navigation digests were rechecked. The following exact XHTML targets were confirmed in their OPF manifests and reading spines before hashing:

- El Camino de los Reyes chapter 9 — OEBPS/Text/L1-023.xhtml — c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945;
- Danzante del Filo chapter 10 — OEBPS/Text/010.xhtml — 4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf;
- Esquirla del amanecer chapter 10 — OEBPS/Text/10.xhtml — 0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22.

Three original Spanish summaries were added to staging. Their completed-through evidence watermarks are chapter 9 for El Camino de los Reyes and chapter 10 for each novella; the reader cursors must reach chapters 10 and 11 respectively. All remain pending review. The production registry, approved-claim registry and topic-assignment activation receipt remain unchanged.

The current Library listing did not include cosmere.epub, so no new Cosmere chapter was inspected. No EPUB bytes, XHTML bodies or source passages were committed.


## Run 165 — continued Roshar source expansion

A second read-only pass inspected the next numbered chapter in each of the three available Roshar EPUBs: El Camino de los Reyes chapter 10, Danzante del Filo chapter 11 and Esquirla del amanecer chapter 11. Each target was resolved from the existing TOC, confirmed in the OPF manifest and spine, and SHA-256 fingerprinted. Three additional original Spanish summaries were staged with completed-through watermarks 10, 11 and 11; their reader cursors must reach chapters 11, 12 and 12 respectively. All remain pending review.

The staging inventory now contains 57 metadata-only records across 39 distinct chapter-body documents: 39 summaries, one atomic claim, 14 entity dossiers and three relationship claims. Production remains empty.

See docs/hoid/ROSHAR_CHAPTER_TEN_ELEVEN_INGESTION.md for the exact source metadata. No EPUB bytes, XHTML bodies or source passages were committed.


## Run 168 — four additional source-backed summaries

Four chapter bodies were inspected from the current Library EPUB copies after revalidating the existing navigation digests and confirming each target in the OPF manifest and reading spine:

- El Imperio Final chapter 4 — EPUB/books/b000001/OEBPS/Text/004.xhtml — 6b729cfc609f926a4bac5b10f3eb5148a7c8935adde54f51f4ff13b9995b35d7;
- El Camino de los Reyes chapter 11 — OEBPS/Text/L1-025.xhtml — 3198740aafd799096672d6a893b925c08a4f33819219e7769761319eaea97ae5;
- Danzante del Filo chapter 12 — OEBPS/Text/012.xhtml — d02ecf9613cb9ae5ff8f95984b2a7bcdf56b19c72e9dcc6f193a1a959150155c;
- Esquirla del amanecer chapter 12 — OEBPS/Text/12.xhtml — d5d73c0ebaaaeccf2dfbd2f16315aa521b860c043c0b61b971bbce76b7bc8990.

Four original Spanish summaries are staged with exact edition-bound locators, document digests and summary digests. Their completed-through evidence watermarks are chapters 4, 11, 12 and 12; their reader cursors must reach chapters 5, 12, 13 and 13 respectively. All four remain pending independent review and are excluded from the production registry.

The staging manifest now contains 57 records across 39 distinct chapter-body documents: 39 summaries, one atomic claim, 14 identity dossiers and three relationship claims. Production remains empty; no activation receipt is created. No EPUB bytes, XHTML bodies, source passages or images are committed.
