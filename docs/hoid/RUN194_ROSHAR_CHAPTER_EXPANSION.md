# Run 194 — Roshar chapters 17/18/18

## Scope

Run 194 starts from the exact Run 193 head `4fc1f51a8375e922226b369261097ce1df93ee2a` on a new branch. It does not modify `main`, Run 193, PR #86 or earlier branches.

## Source selection and integrity

The current Library inventory contained the Roshar omnibus, Danzante del Filo and Esquirla del amanecer EPUBs. The selected copies were materialized only in the working container for offline inspection; no EPUB, XHTML, extracted passage, image or private path was added to Git.

All three ZIP archives passed CRC validation. Their registered navigation SHA-256 values matched the edition records:

- `roshar-omnibus-v1`: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`
- `edgedancer-epub-v1`: `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`
- `dawnshard-epub-v1`: `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075`

For every work, the preceding chapter document digest matched the existing allowlist. The next chapter target was confirmed in the OPF manifest, reading spine and navigation document exactly once.

## New source documents

| Work | Chapter | Relative locator | Previous digest matched | New document SHA-256 |
|---|---:|---|---|---|
| El Camino de los Reyes | 17 | `OEBPS/Text/L1-038.xhtml` | Chapter 16 | `c51c420645b3634d4c99791e215827fda7781a5f5d073ee8516673e61cb7d35e` |
| Danzante del Filo | 18 | `OEBPS/Text/018.xhtml` | Chapter 17 | `fc630c1dccc3e10f77d857bf6d4680cf6a004def6f6a3a2d9810a8906219f671` |
| Esquirla del amanecer | 18 | `OEBPS/Text/18.xhtml` | Chapter 17 | `6025dc6682d083d272e1cc1899c978c2e99fa722b1a5dcb76aa634703342546b` |

## Original summaries staged

Three concise original Spanish summaries were added to `HOID_EDITORIAL_DRAFTS`. Each is bound to its own work ID, chapter number, edition ID, navigation digest, exact relative locator and source-document digest. Each summary has its own UTF-8 SHA-256 digest.

All three records have `review.status = "pending-review"`. No atomic claim, identity dossier, relationship, production knowledge entry or approval receipt was created.

## Spoiler boundary

The three chapter-N summaries retain watermark N and require the reader to reach chapter N+1. The new minimum eligible cursors are:

- El Camino de los Reyes chapter 17 summary: cursor 18.
- Danzante del Filo chapter 18 summary: cursor 19.
- Esquirla del amanecer chapter 18 summary: cursor 19.

The next deterministic ingestion candidates are El Imperio Final chapter 10, El Camino de los Reyes chapter 18, Danzante del Filo chapter 19 and Esquirla del amanecer chapter 19. The current Library EPUB filter did not return `cosmere.epub`; TFE chapter 10 remains uninspected and is not inferred from navigation alone.

## Inventory after Run 194

- Catalogue works: 24.
- Verified navigation locators: 1,106.
- Individually inspected chapter documents: 62.
- Original summaries: 62.
- Editorial records: 80 (62 summaries, 1 atomic claim, 14 identity dossiers, 3 relationships).
- Pending summaries: 62.
- Approved claims: 0.
- Production knowledge entries: 0.

The count of 80 is a staging-bundle count, not an approval or production count.

## Tests and CI

The source-document fingerprint tests, editorial draft validation, source coverage, deterministic ingestion plan and navigation audit were updated for the three new records. Pull-request workflows must still run against the final HEAD before Run 194 can be called CI-validated.

## Branch isolation

Base: `feat/hoid-ia-core-run193` at `4fc1f51a8375e922226b369261097ce1df93ee2a`.

No changes were made to `main`, PR #86 or any earlier branch. No merge was performed.
