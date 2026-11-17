# Roshar Chapter Three Ingestion

## Scope

This run inspected chapter-three XHTML documents from the three unsuffixed private Roshar EPUBs currently accessible in the Library. The EPUB navigation digests were rechecked against the already registered edition identities before chapter bodies were opened.

Only edition metadata, relative locators, individual document SHA-256 digests and original editorial summaries are stored in Git. No EPUB bytes, source XHTML, copied passages, images or fonts are committed.

## Exact inspected documents

| Work ID | EPUB | Relative XHTML path | Navigation SHA-256 | Chapter SHA-256 |
|---|---|---|---|---|
| \`twok\` | El Archivo de las Tormentas | \`OEBPS/Text/L1-015.xhtml\` | \`08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025\` | \`aad893dde20e24a5444100d260f4d466f6ef553a13d676457d6f42015d774a0e\` |
| \`edgedancer\` | Danzante del Filo | \`OEBPS/Text/003.xhtml\` | \`5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517\` | \`2a82686dd7fa7908d4b175f9b03f165309e08ccbb2294c6bcd32443b6d0d3905\` |
| \`dawnshard\` | Esquirla del amanecer | \`OEBPS/Text/3.xhtml\` | \`8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075\` | \`709bca2ea215db4e90fc654b4b503a7c71d96bb40a508d5347ec83006b8cc286\` |

The navigation identities match the edition allowlist. The chapter document digests were calculated over the exact bytes extracted from each EPUB ZIP entry.

## Staged original summaries

Three original Spanish summaries were added:

- \`twok.chapter-003.shallan-kharbranth\`
- \`edgedancer.chapter-003.hauka-grain-cart\`
- \`dawnshard.chapter-003.lopen-talik-delegation\`

Each summary has its own UTF-8 SHA-256 digest, exact edition-bound chapter locator, source-document digest and pending-review state.

All three use chapter 4 as the unlock threshold. A cursor on chapter 4 authorizes only through chapter 3; while chapter 4 is open, the summary remains withheld. It becomes eligible for review only after the cursor advances to chapter 5 or the work is explicitly completed.

## Relationship staging

Three binary relationship claims reference the chapter-three evidence:

- Shallan and Jasnah in the context of Shallan's search for a mentor.
- Hauka and the unnamed girl involved in the grain-cart incident.
- Lopen and Talik during their conversation about Reshi participation in the coalition.

These are staging identifiers, not approved entity records. No aliases, first-appearance claims or production graph edges were added. The relationship review checklist includes an independent entity-identity check.

## Editorial status

- Total original chapter summaries in staging: 11.
- Individually inspected chapter documents: 11.
- Relationship drafts: 3.
- Approved summaries: 0.
- Approved relationship claims: 0.
- Production editorial registry: empty.
- Production entity/alias registry: unchanged.

The relationship packet receipt can record an editorial decision, but an approval returns \`approved-awaiting-source-promotion\` and never promotes knowledge automatically.

## Source availability

The three Roshar EPUBs were accessible in the Library for this run. The Library's EPUB-filtered listing did not contain \`cosmere.epub\`; therefore no new Cosmere chapter body was inspected. Existing Cosmere navigation metadata and the two previously verified El Imperio Final chapter documents remain unchanged.

## Copyright and integrity

Only metadata, opaque relative locators, SHA-256 digests and original editorial prose are committed. Source text was inspected locally and was not copied into the repository.
