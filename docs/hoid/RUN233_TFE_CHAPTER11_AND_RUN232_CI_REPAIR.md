# Run 233 — El Imperio Final chapter 11 and Run 232 CI repair

## Source inspection

The Library file `cosmere.epub` was explicitly selected and inspected locally. The EPUB ZIP passed CRC validation. The registered EPUB 3 navigation document SHA-256 matched the edition record:

- Edition: `cosmere-epub-merged-v1`
- Navigation SHA-256: `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee`
- Previous chapter: 10; its existing XHTML digest matched the allowlist.
- Chapter 11 navigation target: `books/b000001/OEBPS/Text/011.xhtml`
- OPF manifest: exactly one matching item.
- Reading spine: the manifest item is present.
- XHTML size: 21,417 bytes.
- Chapter 11 SHA-256: `c60a18a9ce32dc892111e09e36390672cfa7f30626bdf648394cd4f04e8b4ae2`

No chapter body, excerpt, image, EPUB bytes or private file URI is committed.

## Editorial staging

One original Spanish summary was added:

- ID: `tfe.chapter-011.vin-kelsier-camon-attack`
- Source: El Imperio Final, chapter 11.
- Locator: `nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/011.xhtml`
- Source digest: `c60a18a9ce32dc892111e09e36390672cfa7f30626bdf648394cd4f04e8b4ae2`
- Summary digest: `ac7e05bf315a566f32da1f1dff741c7bbf80fb4b45bf76f3c0ce490c3bf47ce7`
- State: `pending-review`
- Earliest eligible reader cursor: chapter 12.

The summary is staging-only. No approved claim, production knowledge entry, topic assignment or activation receipt was created.

## Run 232 CI regression repair

The final Run 232 HEAD had eight dependent workflows fail because two shared assertions had not advanced with the already-recorded chapter-21 document:

1. `verifiedChapterDocuments.test.ts` incorrectly expected El Camino de los Reyes chapter 21 to be absent.
2. `cosmereNavigationAudit.test.ts` still expected 20 inspected chapter documents for that work.

This run adds positive digest coverage for El Camino de los Reyes chapter 21 and El Imperio Final chapter 11, moves the negative boundaries to chapters 22 and 12 respectively, and updates current source coverage and planner expectations. The spoiler gate is unchanged.

## Inventory after Run 233

| Measure | Value |
|---|---:|
| Individually inspected chapter documents | 71 |
| Original staged summaries | 67 |
| Pending-review summaries | 67 |
| Approved production claims | 0 |
| Production knowledge entries | 0 |
| Activation receipt | none |

The next metadata-only candidates are El Imperio Final chapter 12 and El Camino de los Reyes chapter 22. Every future EPUB inspection still requires explicit local source selection and exact edition binding.

## Privacy and branch isolation

No EPUB, XHTML body, protected passage, image, reading progress, production registry or activation receipt was committed or modified. The source archive was used only in the local inspection environment and is not part of the repository.

This run is based on `feat/hoid-ia-core-run232` at `c2cff09a2bb700b1c69f8d6a781a8b0e82fc94ad`. It does not modify `main`, PR #125, or earlier PR branches. No merge is performed.
