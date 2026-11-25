# Run 321 — explicit work segmentation and chapter 22 evidence

## Scope

Run 321 adds an explicit, edition-bound mapping between EPUB navigation entries and the bibliography work IDs for the three Roshar editions currently available in the Library.

The mapping is structural only. It stores package/navigation fingerprints, spine and TOC ordinal ranges, work IDs and chapter-number counts. It does not store chapter titles, archive paths, XHTML, passages or images.

The catalogue remains 24 works (17 Cosmere, 7 Roshar). In the current Library inventory for this run, six EPUB files were returned: two byte-identical copies for each of the three unique Roshar editions. cosmere.epub was not present in that current inventory. Run 320 recorded an earlier inspection of that file, but this run did not reproduce its availability and therefore does not add any new Cosmere segmentation or chapter evidence.

## Verified structural maps

### Roshar omnibus

- Edition: roshar-omnibus-v1
- EPUB version/navigation: 3.0 / EPUB 3 navigation
- OPF manifest items: 1,687
- OPF spine items: 849
- TOC entries: 702 (552 numbered, 150 sections)
- Package SHA-256: 6eae99f8feccc93a57685108f0f8a8d6af68b7f1858eee63efcf710839cb7477
- Navigation SHA-256: 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025
- Probe candidate fingerprint: 8b178cd0ef3ad7f45d73e5035a80232d53abe5aca9b9e8e6e4a44e9bb233ecd3

| Work ID | TOC ordinals | Spine ordinals | TOC entries | Numbered entries |
|---|---:|---:|---:|---:|
| twok | 2–99 | 5–128 | 98 | 75 |
| wor | 100–216 | 131–272 | 117 | 89 |
| ob | 217–367 | 275–453 | 151 | 122 |
| row | 368–511 | 456–626 | 144 | 117 |
| sawt | 512–701 | 629–845 | 190 | 149 |

TOC ordinals 1 and 702 are unassigned global sections. They are not attributed to a novel. The 147 distinct chapter labels of sawt retain 149 locators because chapters 12 and 14 each occur twice; those pairs remain distinct and cannot be collapsed into a numeric cursor.

### Danzante del Filo

- Edition: edgedancer-epub-v1
- EPUB version/navigation: 2.0 / NCX
- OPF manifest items: 46
- OPF spine items: 30
- TOC entries: 25 (20 numbered, 5 sections)
- Package SHA-256: 27452125a1850a21260c5a48bd17fe6a836424b18be21f6816e0c0e5df3dcf21
- Navigation SHA-256: 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517
- Probe candidate fingerprint: 45554e74551df0c37aa94c23c73db5b230a7f113bef0e8231b5a2de3ecd9f5e5
- All TOC ordinals 1–25 map to edgedancer; spine range 1–29.

### Esquirla del amanecer

- Edition: dawnshard-epub-v1
- EPUB version/navigation: 2.0 / NCX
- OPF manifest items: 47
- OPF spine items: 31
- TOC entries: 24 (19 numbered, 5 sections)
- Package SHA-256: c2a4f08ac83dca9ef6f67347f4429d27c62b0c2424774279ddc028928b5c0732
- Navigation SHA-256: 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075
- Probe candidate fingerprint: 87e0f057680ab2b3c15eedbf009edacc1af3d12a6c2b9b24cd6292d48320ec7a
- All TOC ordinals 1–24 map to dawnshard; spine range 1–31.

## Segmentation contract

epubWorkSegmentation.ts binds a metadata-only probe to the exact package digest, navigation digest, candidate fingerprint, catalogue fingerprint, edition structure and per-work chapter-number policy.

Validation rejects:

- a different package or navigation revision;
- a missing, overlapping or out-of-range work segment;
- an unassigned numbered chapter;
- an incorrect chapter-number sequence;
- duplicate chapter labels whose distinct locators were collapsed;
- duplicate opaque locator IDs;
- getters/accessors or malformed probe records.

The result is verified-structure-only. It explicitly keeps progressUnlockGranted, promotionAllowed and productionWritePerformed false. It does not create a reading cursor or authorize any narrative response.

## Newly inspected chapter document

One additional chapter body was inspected in memory from the Roshar omnibus and then discarded after computing its raw XHTML digest.

| Field | Value |
|---|---|
| Work | twok |
| Chapter | 22 |
| TOC ordinal | 33 |
| Spine ordinal | 49 |
| Edition | roshar-omnibus-v1 |
| Locator | nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-044.xhtml |
| Raw XHTML SHA-256 | f584be238d9ac09a0d1426e61e8f29c7b0d7221b09b692533d2a2ca503f4c148 |
| Editorial status | pending-review |
| Unlock watermark | Completed through chapter 22 (equivalent to opening chapter 23) |

An original Spanish summary was added to editorialDrafts.ts under ID twok.chapter-022.dalinar-sadeas-information-highprince. It covers only chapter 22: the inconclusive saddle-strap inquiry, Dalinar's proposed coordinated campaign, Navani's return and report about defensive half-shards, and Elhokar's appointment of Sadeas to investigate the alleged attack.

The summary is an original editorial paraphrase, not a transcript or a set of copied passages. Its SHA-256 is a44a3e6fd6533b40f0662fe18f4b305d6c1c2e39688cacaa1ecf933e59b6dfd7. The draft remains pending review and is not in the production registry. The evidence unlock watermark is chapter 22, so the summary is withheld while chapter 22 is still open.

## Coverage after Run 321

- Individually inspected chapter documents: 72 total.
- twok: chapters 1–22 (22 documents).
- edgedancer: chapters 1–20 (20 documents).
- dawnshard: chapters 1–19 (19 documents).
- tfe: chapters 1–11 (11 documents).
- Original summaries staged for review: 68.
- Approved production summaries: 0.
- Production registry: empty.

## Privacy and production boundary

- No EPUB or XHTML body was committed.
- No full-text extraction, copied passage, image or source title list was added to the segmentation manifest.
- The chapter 22 body was processed locally in memory; only its digest, edition-bound locator and original summary were retained.
- The new summary remains pending independent editorial review and quorum.
- No knowledge was promoted and no production write was performed.
