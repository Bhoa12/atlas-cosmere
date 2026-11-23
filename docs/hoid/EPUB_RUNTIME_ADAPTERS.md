# EPUB runtime adapters

## Scope

Run 147 supplies concrete, provider-neutral implementations for the three ports used by `createHoidEpubIngestionService()`:

- `HoidEpubArchivePort` via a bounded ZIP reader backed by `fflate` raw DEFLATE.
- `HoidEpubXmlPort` via namespace-aware XML DOM parsing with `@xmldom/xmldom@0.9.12`.
- `HoidEpubDigestPort` via SHA-256 from `@noble/hashes`.

`createHoidEpubRuntimePorts(resolveSourceBytes)` composes these adapters. The resolver receives only an opaque source ID and is intended to return bytes from a locally selected source. It does not receive a path, URL or provider credential. The adapter itself makes no network calls; the caller remains responsible for supplying a local-only resolver.

This is a byte-source adapter, not yet an Expo file-picker integration. The future picker/storage layer must pass bytes into the resolver without uploading the EPUB or persisting its narrative contents in Git.

## ZIP profile and safety

The adapter parses the EOCD, central directory and local file headers itself. It does not call `unzipSync` or `unzip`.

Supported profile:

- Single-disk, classic ZIP (ZIP64 is rejected).
- Stored (method 0) and DEFLATE (method 8) members.
- UTF-8 filenames when the UTF-8 flag is set; otherwise ASCII only.
- Optional signed or signatureless 32-bit data descriptors.
- CRC32 verification after each member read.
- Physical local-header ordering for `ordinal`.
- Local/central filename, flags, method, size and descriptor consistency checks.
- Symlink, encrypted, duplicate, case-fold-colliding, traversal and unsafe paths are rejected by the core or adapter.

Runtime limits:

| Limit | Value |
|---|---:|
| Source archive | 256 MiB |
| Central directory | 16 MiB |
| Entries | 50,000 |
| One decompressed member | 64 MiB |
| XML document | 12 MiB |
| XML nodes | 100,000 |
| XML depth | 256 |

ZIP64, multi-disk archives, encrypted entries, legacy non-ASCII filename encodings and compression methods other than stored/DEFLATE fail closed.

The byte-array adapter keeps a **256 MiB** archive ceiling because it receives the complete source in memory. The Expo random-access adapter has a separate **320 MiB** source ceiling and reads only the ZIP tail, central directory and requested members. Both derive their limits from `HOID_EPUB_INGESTION_LIMITS`; the larger range budget does not increase any per-member or aggregate decompression limit. The adapter preallocates a bounded output buffer one byte larger than the declared uncompressed size. That sentinel detects output-size mismatches without allowing the inflater to grow its buffer. It never asks fflate to enumerate or extract the ZIP.

### Dependency security note

`fflate@0.8.3` is pinned. The reviewed ZIP64 denial-of-service advisory was fixed in 0.8.3; this adapter independently rejects ZIP64 sentinels and does not call the affected `unzipSync` entry point. A separate unreviewed 2026 advisory discusses memory allocation in `unzipSync` and is disputed by the maintainer; the implementation therefore keeps its own size checks and bounded output allocation rather than treating the package version as a substitute for validation. Reassess this dependency before upgrading or changing the decompression API.

## XML profile

`@xmldom/xmldom@0.9.12` parses XML into a namespace-aware DOM. The adapter rejects DTD and entity declarations before parsing, supplies no external-resource resolver, and configures `onError` to fail on warnings, errors and fatal errors. A bounded lexical preflight counts element nodes and nesting depth before DOM allocation. Only UTF-8 XML is accepted; UTF-16 and legacy encodings are rejected instead of being guessed.

The parser is a platform-edge implementation behind `HoidEpubXmlPort`; the ingestion core does not import it. The pinned 0.9.12 release is the maintained scoped package, not the deprecated unscoped `xmldom` package. Reassess the pin and its advisories before upgrades. The upstream project documents support for the latest two minor lines and publishes security fixes; the release and policy links are recorded below.

Important limitation: upstream explicitly describes xmldom as a non-validating parser and does not guarantee that every not-well-formed construct is reported. Therefore Hoid does not treat DOM parse success as EPUB conformance. It additionally performs a bounded lexical preflight with a qualified-tag stack, rejects DTD/entity declarations, fails on every reported parser warning/error, validates namespaces and required EPUB structure, and keeps the result candidate-only. The parser cannot authorize a chapter, alter progress or approve narrative knowledge by itself.

- Package: https://www.npmjs.com/package/@xmldom/xmldom
- Release 0.9.12: https://github.com/xmldom/xmldom/releases/tag/0.9.12
- Security policy: https://github.com/xmldom/xmldom/security

The application pins `@xmldom/xmldom@0.9.12` directly and uses an npm override for the same exact version so Expo's transitive `@xmldom/xmldom@0.7.13` copy cannot remain in the installed dependency tree. CI inspects the complete tree with `npm ls @xmldom/xmldom --all`.

The XML adapter returns only the metadata required by the ingestion core:

- Container rootfile path and media type.
- OPF title, language, identifiers, manifest and spine.
- EPUB 3 NAV or EPUB 2 NCX labels, hrefs and hierarchy.
- A boolean XHTML root/namespace validation result.

It does not return XHTML body text, paragraphs, dialogue or chapter contents. Text is processed transiently only to obtain OPF metadata and navigation labels.

The parser is not a streaming SAX implementation; DOM allocation is bounded by the 12 MiB XML input limit plus the preflight node/depth limits. The adapter is replaceable through the XML port, so a future parser change does not alter the ingestion core.

## SHA-256

`@noble/hashes@1.8.0` supplies a pure JavaScript SHA-256 implementation. Byte and UTF-8 string inputs produce lowercase, 64-character hexadecimal digests. No WebCrypto, Node crypto module or native Expo module is required.

## Source consistency and TOCTOU

The ingestion core now re-reads the ZIP inventory and re-hashes all package-defining members (mimetype, container.xml, OPF and navigation) immediately before issuing a package candidate. If the source changes while inspection is in progress, the candidate is rejected with `source-changed` even when the changed member retains the same path and byte length.

Chapter inspection continues to revalidate the inventory and package-defining documents before it reads the requested navigation-backed XHTML member.

## Privacy and promotion boundary

- No EPUB bytes are sent to GitHub, a model provider or a network service.
- No EPUB, XHTML, chapter body or extracted prose is committed.
- Runtime adapters return only archive metadata, OPF metadata, navigation metadata, hashes and validation booleans.
- Inspection produces candidate-only records.
- Verified chapter allowlists, editorial summaries, claims and production knowledge remain unchanged.
- Human review and the existing protected promotion authority remain mandatory.

## Validation

`epubRuntimeAdapters.test.ts` uses synthetic, non-copyright fixtures to exercise stored/DEFLATE entries, CRC failures, ZIP64 rejection, traversal, duplicate paths, encryption flags, local/central header disagreement, EPUB 3 NAV, EPUB 2 NCX, DTD rejection, UTF-8 validation and SHA-256 vectors.

`epubIngestion.test.ts` also verifies that changing navigation bytes during package inspection prevents issuance of a candidate.

## Remaining integration

The Expo local provider, bounded range reader and reader-facing import panel are now implemented. A separate local metadata-only audit of four private EPUBs confirmed their ZIP integrity and registered navigation digests; see `EXPLICIT_EPUB_IMPORT_UI.md`. That audit did not execute the TypeScript adapter against those files or inspect chapter XHTML. Android/iOS device testing and an end-to-end TypeScript runtime audit against the local files remain outstanding.


## Local reader text projection (Run 256)

The concrete XML adapter now exposes an optional `extractReadableBlocks()` capability. It parses a chapter XHTML document with the same bounded, namespace-aware parser and returns only frozen plain-text blocks (`heading`, `paragraph`, `quote`, `list-item`). Script, style, navigation, SVG, embedded media and form elements are excluded. Raw HTML, URLs, resource paths and byte arrays are never returned to the UI.

`HoidEpubIngestionService.readChapterContent()` is a separate, optional local-reader operation. It requires the exact in-memory package candidate issued by that ingestion service, resolves a target already present in the verified navigation, reads the chapter under the existing member-size limit, rechecks the package/navigation/chapter identity, compares the chapter digest, and only then returns canonical text blocks. A parser without the safe extraction capability fails closed.

The content result is ephemeral UI data. It is not persisted, sent to a language provider, added to the inspected-document allowlist, used to approve claims, or used to update progress. The reader currently provides a text-only chapter view; it is not a full-fidelity EPUB renderer for images, CSS, page layout or media.
