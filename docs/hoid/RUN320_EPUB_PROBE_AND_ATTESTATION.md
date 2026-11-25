# Run 320 — EPUB structure probe and reviewer attestation issuance

## Scope

Run 320 adds two provider-neutral primitives:

1. A metadata-only EPUB structural probe for EPUB 2 NCX and EPUB 3 navigation.
2. An attestation issuer that delegates signing to an injected Ed25519-capable port.

Neither primitive is a production authorization or a knowledge promotion.

## EPUB probe boundary

The probe reads only:

- mimetype;
- META-INF/container.xml;
- the package OPF;
- the EPUB 3 TOC document or EPUB 2 NCX.

It validates ZIP central-directory bounds, rejects ZIP64, multi-disk and encrypted entries, rejects traversal paths and symlinks, validates local headers and CRC32, and decompresses only bounded metadata entries. It does not decompress chapter XHTML, images, fonts or other book payloads.

The output contains package/navigation digests, spine ordinals, explicitly numbered TOC labels, opaque locator IDs and edition-wide repeated-number information. It does not infer work boundaries: repeated labels across a multi-book omnibus are not evidence of duplicate chapters within one work. It never returns chapter titles, hrefs, archive paths, XHTML, excerpts, chapter-body digests or EPUB bytes.

The parser reads a TOC label only long enough to classify an explicit numeric chapter label. The label itself is discarded. Non-numeric entries remain sections. The returned ordinal is only an ordinal within the TOC, not a book-specific progress cursor.

## Candidate is not authority

Every probe result has:

- chapterBodiesInspected = false;
- progressUnlockGranted = false;
- promotionAllowed = false;
- productionWritePerformed = false.

A probe is an untrusted structural candidate. It must be compared manually against the declared bibliography/edition and reviewed before any navigation hash, locator or reading manifest is added to the checked-in allowlists. The probe never edits editionStructure, verifiedChapterLocators, verifiedChapterDocuments, progress or evidence registries.

A matching navigation hash demonstrates byte identity of the TOC document only. It does not prove chapter-body inspection or narrative accuracy.

## Reviewer attestation issuer

The function issueHoidEditorialBundleReviewAttestation constructs the existing domain-separated signing message from the validated promotion plan and exact Pull Request context, then delegates the message to an injected signer port.

The signer port is the only key-custody boundary. No private keys, reviewer roots, reviewer identities, hardware APIs or provider SDKs are created or bundled here.

The result is named issued-unverified. It is not trusted until the application-facing trusted host:

1. rebuilds the promotion plan against live progress;
2. checks the persisted minimum reviewer-registry revision;
3. verifies the signature against the root-authenticated reviewer registry;
4. verifies the independent whole-bundle quorum and all per-packet receipts;
5. checks the exact protected Pull Request context.

A signing failure blocks. A malformed signature is rejected. A signed rejection remains a rejection.

## Source availability

The private source files were available in the Library and were inspected locally at the ZIP/container/OPF/navigation layer. The automated parser tests use synthetic EPUB fixtures; the local source inspection is reported separately below. No private EPUB bytes, extracted text, XHTML, chapter titles or paths are committed.

## Validation

The dedicated workflow is configured to run the probe and attestation issuer tests plus regressions for the review kit and quorum, followed by strict TypeScript checking. No workflow run or combined check status was returned for the final HEAD during this execution, so CI is not reported as passed.

## Isolation

- Base: feat/hoid-ia-core-run319 at 698390e555f757130bfa77ff28d94e11fe0bae4c.
- Branch: feat/hoid-ia-core-run320.
- Pull request is a draft; no automatic merge.
- No change to main, PR #212 or earlier branches.


## Private EPUB metadata verification performed in Run 320

The private source files were present in the Library and inspected locally at the ZIP/container/OPF/navigation layer only. The following navigation-document SHA-256 values exactly match the existing edition metadata already checked into the repository:

| Source edition | Bytes | EPUB package | Navigation | TOC entries | Numeric labels | OPF SHA-256 | Navigation SHA-256 |
|---|---:|---|---|---:|---:|---|---|
| cosmere.epub | 291,827,353 | EPUB 3 | EPUB 3 nav | 986 | 735 | f55b6e832108e10888a285c2ac948c62e1f907b73bcbd86ff33b1a7198d98f23 | 85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee |
| Roshar five-book omnibus | 97,318,466 | EPUB 3 | EPUB 3 nav | 702 | 552 | 6eae99f8feccc93a57685108f0f8a8d6af68b7f1858eee63efcf710839cb7477 | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 |
| Danzante del Filo | 2,176,643 | EPUB 2 | NCX | 25 | 20 | 27452125a1850a21260c5a48bd17fe6a836424b18be21f6816e0c0e5df3dcf21 | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 |
| Esquirla del amanecer | 2,062,244 | EPUB 2 | NCX | 24 | 19 | 865caecac999c564db74170ee4936c1c88eb8b7154001f5b6012ba7341e70960 | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 |

The OPF and navigation hashes are metadata fingerprints only. No archive, OPF, navigation XML, title, href, XHTML or chapter text was copied into the repository.

The five-book omnibus and cosmere.epub contain multiple works. The Roshar omnibus has five internal L1–L5 navigation prefixes; 700 of its 702 TOC links target those prefixes. The Cosmere archive has 15 internal b000001–b000015 package prefixes across its 986 TOC links. Those archive prefixes are not assumed to be one-to-one with the 17 bibliographic work IDs, especially for collections and multi-volume works. Repeated numeric labels across an entire TOC are therefore expected and cannot be treated as duplicate chapter numbers within one work. The probe deliberately reports edition-wide repeated labels and sets workSegmentation to not-inferred. A later reviewed mapping must segment each work before it can create book-specific reading cursors.

The probe implementation is capped at 384 MiB so it can accept the verified 291,827,353-byte cosmere.epub archive. Its metadata extraction remains separately bounded to 2 MiB per selected XML file and 4 MiB total. Chapter XHTML and media entries are not decompressed.
