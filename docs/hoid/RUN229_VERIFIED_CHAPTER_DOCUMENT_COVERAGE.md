# Run 229 — Verified chapter-document coverage expansion

## Objective

Extend the sparse, edition-bound chapter-document allowlist using the user's private EPUBs that were available in Library. This run records byte-integrity metadata only; it does not create narrative summaries, editorial claims or production knowledge.

## Source verification performed

The following local EPUBs were available and inspected without uploading them to the repository:

- `cosmere.epub`
- El Archivo de las Tormentas 1–5 omnibus
- `Danzante del Filo`
- `Esquirla del amanecer`

All four ZIP archives passed CRC validation. The navigation fingerprint matched the registered edition value for each source. The Cosmere and Roshar omnibus use EPUB 3 navigation documents; the two standalone novellas use EPUB 2 NCX navigation documents.

For every new chapter target:

1. The exact relative target appeared in the edition's navigation document.
2. It resolved to exactly one OPF manifest item.
3. The item was present in the reading spine.
4. The immediately preceding chapter digest matched the existing allowlist.
5. The raw uncompressed XHTML bytes produced the SHA-256 recorded below.

The first previously allowlisted chapter digest in each source was also checked against the Library copy before extending the allowlist.

## New edition-bound document digests

| Work ID | Chapter | Edition ID | Relative XHTML target | Bytes | SHA-256 |
|---|---:|---|---|---:|---|
| `tfe` | 10 | `cosmere-epub-merged-v1` | `books/b000001/OEBPS/Text/010.xhtml` | 42,882 | `a1a42419b3a0e8c63fdd15c6ec63d556dc11dfb3c3b9cffc04265d2c4a7ac472` |
| `twok` | 18 | `roshar-omnibus-v1` | `L1-040.xhtml` | 59,816 | `e8fec5f6b12f132a5469db8cc40afa90f31e675450c6b0f7050a64d94e6813cc` |
| `edgedancer` | 19 | `edgedancer-epub-v1` | `Text/019.xhtml` | 21,124 | `50771bbaad3f2767b1e4dd626b5bca7150ee980f858d83729d6469e70fefe9bd` |
| `dawnshard` | 19 | `dawnshard-epub-v1` | `Text/19.xhtml` | 28,200 | `fdfdc11b97d409903be789ffd09b885bc3ab1c039cfae4ccbf4047005300bac6` |

## Coverage and planner effect

- Individually inspected chapter documents: **66** across four works.
- Original staged summaries: **62**, all still `pending-review`.
- Approved production claims: **0**.
- Production knowledge entries: **0**.
- Reading progress changed: **No**.
- Editorial summaries created: **No**.

The deterministic planner now has three continuation candidates:

| Work | Next chapter document candidate |
|---|---:|
| El Imperio Final | 11 |
| El Camino de los Reyes | 19 |
| Danzante del Filo | 20 |

Esquirla del amanecer is complete only for the 19 numbered units in its current reading manifest. This does not include unmodelled front matter, back matter, appendices or narrative review.

The next-reader-cursor boundary remains N+1 for any future summary based on chapter N. A document digest alone does not create a summary, approve a claim or unlock narrative content.

## Copyright and privacy boundary

No EPUB bytes, XHTML body, chapter title, copied passage, extracted prose, image or private file URI was committed. The repository receives only edition IDs, relative navigation targets, chapter numbers, byte lengths and SHA-256 digests.
