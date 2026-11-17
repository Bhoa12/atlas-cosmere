# Hoid complete editorial knowledge bundle

Run 120 introduces a metadata-only bundle manifest that binds the four editorial staging categories into one deterministic inventory:

- original chapter summaries;
- atomic claims;
- entity identity dossiers;
- relationship claims.

## Validation boundary

The builder re-runs the domain validators for all four categories. A record is included only when its existing edition-bound source locator, navigation digest, chapter-document digest, original-text digest and pending-review state validate.

The manifest contains only:

- category and stable record ID;
- a SHA-256 digest for each complete editorial record;
- exact source metadata (work, chapter, opaque locator, edition, navigation digest, document digest);
- the source's independent unlock work and chapter;
- deterministic cross-reference blockers;
- one SHA-256 fingerprint for the complete manifest.

It does not contain summary prose, claim statements, EPUB passages, XHTML bodies, extracted text or images.

## Cross-reference rules

- Every atomic claim subject must have an entity dossier with the same stable ID and knowledge kind.
- Both participants of every relationship must have entity dossiers with matching IDs and kinds.
- A missing or mismatched identity blocks the bundle. It is never repaired by fuzzy matching or inferred from a summary title.
- Source records are deduplicated by their complete edition-bound evidence scope, including unlock threshold.

The current staging set is expected to remain blocked while the TFE atomic claim subject `tfe.vin` lacks a matching identity dossier. The existing Roshar relationship participants have matching identity dossiers.

## Review and production

`ready-for-review` means only that the inventory's cross-references are internally complete. It does not mean the records are approved, the source-control reviews are authenticated, or the bundle can be promoted.

Every record remains pending editorial review. The result always contains:

- `promotionAllowed: false`;
- `productionWritePerformed: false`.

This module has no production registry import, database write, GitHub SDK, network access or provider dependency. The protected promotion authority remains a separate gate and still requires a trusted source-control adapter, an authoritative live-progress adapter and a maintainer-controlled change.

## Revalidation

`validateHoidEditorialKnowledgeBundleManifest(manifest, sourceInput)` rebuilds the bundle from the exact four source batches and compares the canonical manifest and fingerprint. A changed source batch, record digest, source locator, unlock threshold, cross-reference or ordering invalidates the prior manifest.

## Tests

`editorialKnowledgeBundle.test.ts` covers deterministic inventory, exact category counts, missing claim subjects, relationship participant links, manifest tampering, changed source inventories, sparse arrays, accessor-backed inputs, prose exclusion and unexpected fields.
