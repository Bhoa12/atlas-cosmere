# Run 146 — Offline EPUB ingestion and source verification

## Purpose

The epubIngestion.ts module defines a provider-neutral, offline inspection pipeline for user-supplied EPUB files. It verifies package structure and navigation metadata, and can fingerprint one XHTML document explicitly selected through the inspected navigation.

The pipeline is intentionally candidate-only. It does not mutate the bibliography, edition progress policies, verified navigation allowlists, individually inspected-document allowlists, editorial staging, production registries or reading progress.

## Ports

The core receives three injected dependencies:

- HoidEpubArchivePort: lists ZIP central-directory metadata and reads one bounded entry by canonical archive path.
- HoidEpubXmlPort: parses container.xml, the OPF package document and EPUB 3 navigation / EPUB 2 NCX into strict normalized contracts; it validates XHTML without returning prose.
- HoidEpubDigestPort: computes SHA-256 for bytes and canonical UTF-8 metadata.

No ZIP, XML, filesystem, Expo, Node or cloud SDK is imported by the core. A future local adapter can use an approved ZIP/XML implementation without changing the ingestion contracts.

## Package inspection

createHoidEpubIngestionService() returns two operations:

1. inspectPackage(sourceDescriptor):
   - validates the opaque source ID and resolves the work ID against the canonical bibliography, requiring the exact source group and edition ID from the checked-in edition policy;
   - checks archive entry count, physical local-header ordinal continuity, path canonicalization, duplicate/case-fold collisions, symlinks, encryption, compression method, local-header metadata, per-entry and aggregate expanded sizes, and compression ratio;
   - requires mimetype to be the first file entry, stored without compression, exactly 20 bytes, with no local-header extra field and content application/epub+zip;
   - reads the fixed META-INF/container.xml entry and requires exactly one supported OPF rootfile;
   - validates the package version, unique identifier, language, manifest IDs/hrefs/media types, spine references and navigation document;
   - resolves every manifest href relative to the OPF and every navigation href relative to the navigation document, without URL/network access;
   - verifies that manifest and navigation targets exist in the archive;
   - requires the raw navigation-document digest to match the exact edition navigation digest already recorded for that catalogue work;
   - emits archive-inventory, mimetype, container, package-document, navigation-document and source fingerprints.

2. inspectChapterDocument(packageCandidate, navigationHref):
   - accepts only the exact frozen package-candidate object issued by the same service instance;
   - accepts only an XHTML target already present in the inspected navigation;
   - re-lists the archive and rechecks the inventory, OPF and navigation fingerprints to detect source replacement between package and chapter inspection;
   - reads the selected XHTML under a strict size limit, validates it through the injected parser and returns only byte length and SHA-256 metadata.

The chapter operation never returns XHTML bytes, extracted text, headings, paragraph content or a summary.

## Defensive limits

The core currently enforces:

| Limit | Value |
|---|---:|
| Archive entries | 50,000 |
| Aggregate uncompressed size | 512 MiB |
| One archive entry | 64 MiB |
| Container / OPF | 2 MiB each |
| Navigation document | 4 MiB |
| Selected chapter XHTML | 12 MiB |
| Compression ratio | 200:1 |
| Navigation nodes | 50,000 |
| Navigation depth | 24 |
| Manifest items | 20,000 |
| Spine items | 20,000 |

Unsafe absolute paths, backslashes, traversal beyond the archive root, encoded separators, malformed percent escapes, external URLs, duplicate paths and case-fold collisions are rejected. Ambiguous multiple package rootfiles are rejected rather than silently selecting one.


Adapter requirements: the ZIP implementation must validate local-header consistency and CRC32 while decompressing each entry. The XML implementation must disable DTD processing and external entity resolution; parsing is bounded by the byte limits above.

## Trust and promotion boundary

Every result is marked candidate-only. The declared work ID, source group and edition ID must match the canonical bibliography/edition policy, and the raw navigation digest must match that edition's recorded digest. This binds the package navigation to the known edition, but it does not authenticate every chapter body or make a chapter candidate editorially approved.

A candidate fingerprint is an integrity binding, not a signature or editorial approval. The report is not accepted by HoidEvidenceRuntime, does not create a verified locator and does not populate verifiedChapterDocuments.ts.

A maintainer must independently compare the candidate with the catalogue/edition record and review the source before adding any digest to the sparse verified-document allowlist. A TOC entry remains navigation metadata, not proof that a chapter was read or summarized.

The service exposes no write method. It has no GitHub, network, telemetry, upload, cloud-storage or language-provider dependency.

## Current implementation scope and limitations

The ingestion core remains provider-neutral and exposes injected ZIP, XML and SHA-256 ports. Concrete implementations are provided by `epubRangeRuntimeAdapters.ts` (bounded random-access ZIP/DEFLATE), `epubRuntimeAdapters.ts` (xmldom and SHA-256), and the Expo platform provider. The Expo path accepts source archives up to 320 MiB while reading bounded ranges; the legacy whole-buffer adapter remains capped at 256 MiB. Aggregate uncompressed data remains capped at 512 MiB, with the per-entry, central-directory and compression-ratio limits above.

A separate local ZIP/XML metadata audit verified four private EPUB packages against their registered navigation digests. It did not execute the TypeScript Expo runtime against those files, inspect chapter XHTML bodies or expand the verified-chapter allowlist. Android/iOS device testing and end-to-end runtime verification against the local sources remain outstanding.

No EPUB, XHTML body, extracted passage, image or source text is committed. The existing 24-work bibliography, reading progress and production knowledge registry remain unchanged.

## Validation

epubIngestion.test.ts uses synthetic in-memory archive/parser/digest ports to test valid EPUB 3 package inspection, explicit XHTML fingerprinting, traversal and external URL rejection, malformed source descriptors, duplicate paths, compression bombs, directory entries, ambiguous rootfiles, unresolved navigation targets, invalid XHTML, source mutation and cross-service report forgery.
