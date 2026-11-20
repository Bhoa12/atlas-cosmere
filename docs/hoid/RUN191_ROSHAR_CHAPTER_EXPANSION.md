# Run 191 — Roshar chapter-body expansion

## Scope

Run 191 inspects the next contiguous numbered chapter in each of the three Roshar works that already had a verified chapter-body prefix:

- El Camino de los Reyes, chapter 16;
- Danzante del Filo, chapter 17;
- Esquirla del amanecer, chapter 17.

The three current private Library copies were materialized only for local inspection. Each complete ZIP archive passed CRC validation. No EPUB, XHTML body, extracted prose, image, local file path or device URI is included in this repository.

## Edition and navigation integrity

The registered navigation-document SHA-256 values were rechecked and remained unchanged:

| Work | Edition | Navigation SHA-256 |
|---|---|---|
| El Camino de los Reyes | `roshar-omnibus-v1` | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` |
| Danzante del Filo | `edgedancer-epub-v1` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` |
| Esquirla del amanecer | `dawnshard-epub-v1` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` |

The immediately preceding inspected chapter in each source also reproduced its already registered document digest:

| Work | Previous chapter | Existing document SHA-256 | Continuity |
|---|---:|---|---|
| El Camino de los Reyes | 15 | `43ff1d4f608fb3ec230923d92edadd09bc3c9606d72d506b547c7be43266f492` | Match |
| Danzante del Filo | 16 | `d3a247b59d08735b83baa9840ef9e5058cc3f2108c931d66f06d370c4d41a4dd` | Match |
| Esquirla del amanecer | 16 | `d62fefc1ce3e6eab0a0cfa5fa8e08819d5d5a9d3a2b2d12015ffaa9411cd18a2` | Match |

## Chapter target verification

Each target was resolved from the EPUB NCX navigation, matched to exactly one OPF manifest item, and confirmed in the reading spine before hashing the original XHTML bytes.

| Work | Chapter | Relative XHTML target | OPF manifest item | In spine | Document SHA-256 |
|---|---:|---|---|---|---|
| El Camino de los Reyes | 16 | `OEBPS/Text/L1-037.xhtml` | `L1-037_xhtml` | Yes | `1f9d38db4cde7a471586ff7ed5d88cbef7a72b3616020ca1c4d8f06093e7da32` |
| Danzante del Filo | 17 | `OEBPS/Text/017.xhtml` | `x017.xhtml` | Yes | `250c26f671df7422277711bbefd1f72a381a5dd1791bb28d9efb50e7e8c1352c` |
| Esquirla del amanecer | 17 | `OEBPS/Text/17.xhtml` | `x17.xhtml` | Yes | `85fe1ee6a0224ef0ebc04c8f3e327e30a6553f2623a7482be66d5a4e1b2af840` |

## Original editorial summaries

Three original Spanish summaries were added to `HOID_EDITORIAL_DRAFTS`:

| Draft ID | Summary SHA-256 | Evidence watermark | Earliest eligible open cursor |
|---|---|---:|---:|
| `twok.chapter-016.kaladin-choice-and-crisalis` | `0144eabf67c561f71884fb03a523cbf5d8f42f8458dc72fe3aded5bb64d99076` | 16 | 17 |
| `edgedancer.chapter-017.lift-returns-to-the-alley` | `03d9f250332a63ef25c0a8a592b1d1d3d0a08ab3fd511e4db138ba4b13b29576` | 17 | 18 |
| `dawnshard.chapter-017.nikli-negotiation-and-sea-creature` | `c341e1d3a83e251680ad04e2b80cdc95d5ade8cff1e1faf58dec3bd9520c3495` | 17 | 18 |

The summaries are independently hashed and bound to the exact work, edition, navigation digest, locator and document digest. All three remain `pending-review`. No summary was promoted into the production registry, no approved claim was added, and no activation receipt was created.

The unlock convention remains strict: a chapter-N evidence watermark is not complete merely because chapter N is open. The first eligible open cursor is N+1, and progress in another work cannot unlock the draft.

## Coverage after Run 191

| Measure | Result |
|---|---:|
| Catalogue works | 24 |
| Verified navigation locators | 1,106 |
| Individually inspected chapter documents | 58 |
| Original staged summaries | 58 |
| Summaries pending review | 58 |
| Editorial bundle records | 76 |
| Approved claims | 0 |
| Production knowledge entries | 0 |

The 76-record editorial bundle consists of 58 summaries, one atomic claim, 14 identity dossiers and three relationship claims. Its `ready-for-review` state is structural only; it does not represent editorial approval.

The deterministic continuation queue is now:

| Work | Next candidate |
|---|---:|
| El Imperio Final | 9 |
| El Camino de los Reyes | 17 |
| Danzante del Filo | 18 |
| Esquirla del amanecer | 18 |

The current Library listing contains the Roshar EPUBs used in this run but does not contain `cosmere.epub`. Therefore El Imperio Final chapter 9 remains a metadata-only candidate and was not inspected.

## CI regression found and corrected

The first PR validation run exposed one stale assertion in `cosmereNavigationAudit.test.ts`: it still expected the pre-Run-191 chapter-document counts (15 for El Camino de los Reyes and 16 for each novella). The verified document allowlist correctly returned 16, 17 and 17.

All four affected workflows shared this same assertion. The stale expectations were updated to 16 / 17 / 17 in a dedicated test-only commit. No production runtime code or authorization policy was weakened.

The corrected code/test commit `e08d02a0dda028a4a9abe6bf646090335f0121ac` then passed **15/15 GitHub Actions workflows**, including source coverage, editorial draft validation, source ingestion, offline EPUB ingestion, Cosmere navigation audit, reading manifests, atomic-claim spoiler gating and the complete editorial review bundle. Subsequent commits update documentation only; none changes source code or tests.

## Validation boundary

The source inspection was performed locally. Only relative archive locators, edition metadata, document digests, original summary prose and summary digests were committed. No EPUB bytes, XHTML body, copied passage, extracted source text, image, private file path or device URI was committed.

The existing offline ingestion, source-coverage, editorial-draft and cursor-evidence workflows must pass on the final branch head before Run 191 is considered validated.
