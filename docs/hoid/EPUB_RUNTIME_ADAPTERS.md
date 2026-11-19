# EPUB runtime adapters

## Scope

Run 147 supplies concrete, provider-neutral implementations for the three ports used by `createHoidEpubIngestionService()`:

- `HoidEpubArchivePort` via a bounded ZIP reader backed by `fflate` raw DEFLATE.
- `HoidEpubXmlPort` via namespace-aware, strict XML parsing with `saxes`.
- `HoidEpubDigestPort` via SHA-256 from `@noble/hashes`.

`createHoidEpubRuntimePorts(resolveSourceBytes)` composes these adapters. The resolver receives only an opaque source ID and must return the bytes of a locally selected source. It does not accept a path, URL, remote fetch function, or provider credential.

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

ZIP64, multi-disk archives, encrypted entries, legacy non-ASCII filename encodings and compression methods other than stored/DEFLATE fail closed. The adapter preallocates the exact bounded output buffer before calling raw `inflateSync`; it never asks fflate to enumerate or extract the ZIP.

### Dependency security note

`fflate@0.8.3` is pinned. The reviewed ZIP64 denial-of-service advisory was fixed in 0.8.3; this adapter independently rejects ZIP64 sentinels and does not call the affected `unzipSync` entry point. A separate unreviewed 2026 advisory discusses memory allocation in `unzipSync` and is disputed by the maintainer; the implementation therefore keeps its own size checks and bounded output allocation rather than treating the package version as a substitute for validation. Reassess this dependency before upgrading or changing the decompression API.

## XML profile

`saxes@6.0.0` parses XML with namespace processing and strict well-formedness checks. DTD and entity declarations are rejected before parsing, and the parser is never given a resolver for external resources. Only the five predefined XML entities are accepted by the parser.

The adapter currently supports UTF-8 XML. UTF-16 and legacy encodings are rejected instead of being guessed.

The XML adapter returns only the metadata required by the ingestion core:

- Container rootfile path and media type.
- OPF title, language, identifiers, manifest and spine.
- EPUB 3 NAV or EPUB 2 NCX labels, hrefs and hierarchy.
- A boolean XHTML root/namespace validation result.

It does not return XHTML body text, paragraphs, dialogue or chapter contents. Text is processed transiently only to obtain OPF metadata and navigation labels.

The Saxes project is archived upstream. It has no known direct advisories in the package database at the time of this implementation, but its maintenance status is a tracked risk. The XML port isolates the parser so a maintained replacement can be introduced without changing the ingestion core.

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

The next step is an Expo-compatible local file provider (picker, cache URI and bounded byte/range reads), followed by device testing on Android and iOS. No real private EPUB has been inspected by this run.
