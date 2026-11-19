# Expo local EPUB access

## Scope

Run 148 adds an Expo SDK 51 document-picker boundary and a random-access ZIP archive port. The provider keeps the selected URI in memory only and exposes an opaque source ID, display name and byte length. It does not persist the URI, upload the file or send bytes to GitHub or a model provider.

The selected filename is not used to infer a Cosmere work or edition. A caller must bind the opaque source ID to a catalog workId, editionId and source group explicitly before calling the ingestion service. The ingestion core then requires the registered navigation SHA-256 to match the edition catalog.

## SDK 51 package versions

The app remains on Expo SDK 51 (expo ~51.0.0). The SDK 51 Expo source branch publishes:

- expo-document-picker 12.0.2
- expo-file-system 17.0.1

The SDK 51 ReadingOptions contract supports position and length only when encoding is Base64. The provider uses those range options and decodes each result into a bounded Uint8Array. It does not call readAsStringAsync without a range.

The picker uses copyToCacheDirectory: true, because Expo documents this as the option that makes a picked document immediately readable by FileSystem. The temporary copy is deleted on release only when its URI is beneath the app cache directory. External provider URIs are never deleted.

## Memory model

The original byte-array resolver remains available for tests and small sources. The Expo path uses HoidEpubRandomAccessSource:

- read the ZIP tail to locate EOCD;
- read only the central directory;
- read the local header for mimetype;
- read a local header and one compressed member only when that member is requested;
- decompress one member into a bounded output buffer and verify CRC32.

Expo FileSystem reads each requested range in 48 KiB Base64 chunks. The provider caps one range at 16 MiB; the archive parser caps the central directory at 16 MiB and one compressed member at 64 MiB. The complete EPUB is never materialized as a JavaScript Uint8Array.

The ZIP adapter returns localHeaderExtraFieldLength: null for entries whose local header has not yet been inspected. It validates the exact local header before reading that entry. The mimetype local header is inspected during inventory listing and must have no extra field.

## Source stability

The provider records file size and modification time at selection and rechecks them before each range read. The range archive adapter also checks local/central header agreement, member bounds, CRC32 and the central directory. The ingestion core continues to re-read and hash package-defining documents before issuing a candidate.

File modification timestamps are not treated as cryptographic proof. The existing SHA-256 checks remain authoritative for package metadata, navigation and inspected XHTML.

## Privacy and lifecycle

- URI mappings exist only in the provider's in-memory map.
- No URI, EPUB bytes or chapter body is written to SQLite or Git.
- release(sourceId) removes the mapping and best-effort deletes only a cache-owned copy.
- releaseAll() releases all active selections.
- The selected filename is display metadata only; it does not establish book identity.
- The provider does not infer chapter numbers from navigation labels.
- Inspection results remain candidate-only and require human review before the verified chapter allowlist or production registry changes.

## Failure behavior

The provider fails closed for canceled, malformed, non-EPUB-named, unavailable, changed or oversized selections. A missing source mapping returns null; invalid ranges and short Base64 reads throw. Callers should translate these failures to a neutral local-import error and must not log file URIs or file contents.

## Tests

The synthetic tests cover:
- range-based ZIP indexing without whole-archive reads;
- stored and DEFLATE member extraction;
- local/central header and CRC checks;
- short range reads and archive size limits;
- picker cancellation and invalid extensions;
- cache copy options;
- 48 KiB bounded Base64 reads;
- file-change detection;
- release cleanup without deleting external provider URIs.

No private EPUB was available to this run. No real source edition was inspected and no coverage or production knowledge record was changed.

## Remaining validation

The adapter is compiled against the SDK 51 package types and checked in CI. Android/iOS device testing is still required for SAF/content URIs, iCloud-backed documents, cache-copy behavior, memory pressure and native bridge performance. The Saxes XML dependency remains isolated behind HoidEpubXmlPort; its upstream repository is archived and must be replaced before treating the XML stack as a long-term production dependency.
