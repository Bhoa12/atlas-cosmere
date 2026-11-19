# Explicit local EPUB import and edition binding

## Scope

Run 149 adds a reader-facing import panel to Hoid. The panel lets the reader choose a local EPUB, then explicitly select one of the 24 canonical works and its registered edition. The filename is display metadata only and is never used to infer a work, source group or edition.

The binding is built by `createHoidEpubSourceDescriptor(sourceId, workId, editionId)`. It accepts only a known bibliography work and the exact edition returned by `getHoidEditionProgressPolicy`. The resulting descriptor is passed to the existing offline ingestion service, which verifies the package navigation digest against the registered edition.

## Reader flow

1. Tap **Importar EPUB** and select one local `.epub` file through the Expo document picker.
2. Select the work and registered edition from the explicit catalogue list.
3. Hoid inspects ZIP structure, OCF container, OPF metadata, manifest, spine and navigation.
4. The UI displays only non-narrative metadata and structural counts: edition ID, language, navigation-entry count, XHTML target count and spine count.
5. The UI never displays chapter labels or chapter bodies. It states that package verification is not chapter inspection or editorial approval.
6. The reader can bind another work/edition to the same selected source, change the file, or release the temporary source.

## Spoiler and trust boundaries

- The UI does not render navigation labels, XHTML, chapter titles or prose.
- Package inspection creates only an in-memory candidate. It does not update verified locators, inspected-chapter allowlists, editorial staging or production registries.
- The import flow does not change SQLite reading progress, completion state or unlock thresholds.
- A navigation SHA match binds the package to the registered edition policy; it does not prove that every chapter body has been inspected or approved.
- Ambiguous works retain their existing progress policies: White Sand volumes remain unsegmented, Elantris and Viento y Verdad retain their safe numeric prefixes, and Arcanum remains a section collection.
- Source IDs and file URIs are ephemeral. The panel releases its active source on unmount and offers an explicit release action.
- No EPUB bytes, XHTML body, private URI or extracted prose is sent to GitHub or a language provider.

## XML parser migration

The inactive, long-unreleased Saxes dependency is replaced by the pinned `@xmldom/xmldom@0.9.12` package behind the existing XML port. DTD and entity declarations are rejected before parsing, all parser warnings/errors fail closed, and a lexical preflight enforces XML byte, node-count and nesting-depth limits before DOM construction. The parser remains replaceable without changing the provider-neutral ingestion core.

## Validation

- Explicit catalogue/edition binding tests cover all 24 works and the two source groups.
- XML adapter regression tests cover EPUB 2/3 navigation, namespace handling, DTD/entity rejection, malformed XML, UTF-8 validation, node/depth limits, comments and CDATA.
- TypeScript strict checks include the import panel and HoidScreen.
- Android/iOS physical-device testing remains required for document-provider URI behavior, native memory pressure, cache lifecycle and picker cancellation.

### Read-only source check (2026-11-19)

Three Roshar source EPUBs were available in the user's Library and were checked locally without copying their contents into the repository:

| Registered edition | ZIP entries | OPF manifest | Spine | Navigation entries | Unique XHTML targets | Registered navigation SHA-256 |
|---|---:|---:|---:|---:|---:|---|
| `roshar-omnibus-v1` | 1,690 | 1,687 | 849 | 713 | 706 | Match |
| `edgedancer-epub-v1` | 50 | 46 | 30 | 25 | 25 | Match |
| `dawnshard-epub-v1` | 51 | 47 | 31 | 24 | 24 | Match |

All three archives passed ZIP CRC verification, placed the uncompressed `mimetype` entry first, and declared `application/epub+zip`. Their navigation-document SHA-256 values exactly matched the registered edition structures.

This was an independent, read-only ZIP/XML metadata check, not an execution of the Expo runtime adapter. No chapter XHTML bodies or chapter labels were inspected, no verified-chapter allowlist was expanded, and no progress or editorial registry was changed. The Cosmere `cosmere.epub` file was not present in the accessible Library EPUB listing for this run, so no new Cosmere source verification is claimed.
