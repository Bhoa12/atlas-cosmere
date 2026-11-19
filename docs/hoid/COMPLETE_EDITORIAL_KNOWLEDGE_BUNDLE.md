# Hoid complete editorial knowledge bundle

Run 121 closes the atomic-claim subject reference for `tfe.vin` using a separate identity dossier backed by the previously verified chapter-one source document. Run 124 adds three more original chapter summaries after inspecting the current Roshar EPUB copies.

## Current staging inventory

The deterministic metadata-only manifest now contains:

- 32 original chapter summaries;
- 1 atomic claim;
- 14 entity identity dossiers;
- 3 relationship claims;
- 32 distinct edition-bound source documents.

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

The staging manifest now contains 50 records across 32 distinct chapter-body documents: 32 summaries, one atomic claim, 14 identity dossiers and three relationship claims. Its status remains `ready-for-review`; no summary or dossier is approved by this structural status.

The chapter-eight summary unlocks only after chapter nine is completed. The three chapter-nine summaries unlock only after chapter ten is completed. The two chapter-ten summaries unlock only after chapter eleven is completed. All five remain pending review and are excluded from the production registry.

See `docs/hoid/ROSHAR_CHAPTER_NINE_INGESTION.md` for exact edition IDs, navigation digests, relative locators and document digests. No EPUB bytes, XHTML bodies or source passages were committed.


## Run 165 — chapter-nine and chapter-ten Roshar expansion

The current Library listing contained the Roshar omnibus, Danzante del Filo and Esquirla del amanecer EPUBs. Their existing navigation digests were rechecked. The following exact XHTML targets were confirmed in their OPF manifests and reading spines before hashing:

- El Camino de los Reyes chapter 9 — OEBPS/Text/L1-023.xhtml — c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945;
- Danzante del Filo chapter 10 — OEBPS/Text/010.xhtml — 4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf;
- Esquirla del amanecer chapter 10 — OEBPS/Text/10.xhtml — 0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22.

Three original Spanish summaries were added to staging. Their unlock thresholds are chapter 10 for El Camino de los Reyes and chapter 11 for each novella. All remain pending review. The production registry, approved-claim registry and topic-assignment activation receipt remain unchanged.

The current Library listing did not include cosmere.epub, so no new Cosmere chapter was inspected. No EPUB bytes, XHTML bodies or source passages were committed.
