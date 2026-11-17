# Verified chapter locators

## Scope

Run 101 adds exact, edition-bound chapter locators for the three unique Roshar EPUBs currently available in the Library runtime:

- the combined EPUB containing the five main Stormlight Archive novels;
- the separate Edgedancer EPUB;
- the separate Dawnshard EPUB.

The Library contains duplicate copies of these files. Duplicates are not treated as additional editions. The private `cosmere.epub` file was not present in the current Library listing, so no per-chapter locators are claimed for its works in this run. Its existing catalogue and previously recorded structural metadata remain separate from passage-level evidence.

## Metadata extracted

Only EPUB package metadata and navigation documents were inspected. The implementation stores no chapter titles, body text, excerpts, or prose. Each chapter locator is namespaced by the edition ID and the SHA-256 digest of the navigation document, followed by the relative EPUB navigation href.

| Work ID | Verified numbered chapters | Edition |
|---|---:|---|
| `twok` | 75 | `roshar-omnibus-v1` |
| `wor` | 89 | `roshar-omnibus-v1` |
| `ob` | 122 | `roshar-omnibus-v1` |
| `row` | 117 | `roshar-omnibus-v1` |
| `sawt` | 1–11 only | `roshar-omnibus-v1` |
| `edgedancer` | 20 | `edgedancer-epub-v1` |
| `dawnshard` | 19 | `dawnshard-epub-v1` |

The navigation table for `sawt` contains repeated numbered chapter values at 12 and 14. The numeric cursor remains capped at chapter 11; no locator is generated for either duplicate or any later chapter until the reading model can distinguish the duplicate units.

## Runtime enforcement

`verifiedChapterLocators.ts` contains relative navigation href metadata only. `readingManifest.ts` attaches a locator to a numbered unit only when both the edition ID and navigation digest match the inspected source record.

`canonicalEvidenceScope()` now requires:

1. a known bibliography work;
2. a source chapter that exists in the current numeric manifest;
3. a locator ID exactly equal to that chapter unit's edition-bound locator;
4. an unlock chapter that also exists in the same manifest;
5. an unlock threshold that does not precede the cited source chapter.

A plausible string such as `twok-chapter-2` is not accepted as provenance. The runtime also validates `firstSafeAppearance` against a real unit in its own work manifest. Unknown, unsegmented, ambiguous, or unavailable source locators fail closed before a selector can be called.

For works in `cosmere.epub`, chapter progress metadata may still exist, but no verified locator is exposed by this run because that EPUB was not available for inspection here. This does not prevent reading-progress display; it prevents editorial claims from asserting passage-level provenance until the source navigation is actually available.

## Explicit limitations

- These locators prove a position in an inspected EPUB navigation document. They do not prove that a narrative summary was reviewed.
- No new narrative claims were added to the production editorial registry.
- No EPUB prose was copied into the repository.
- Prologues, preludes, interludes, epilogues, Ars Arcanum, acknowledgements, and other special sections are not yet represented as cursor units. Their presence in a TOC is not enough to authorize them as a reading position.
- Arena blanca and Arcanum ilimitado remain unavailable for partial numeric progress until their internal works and units are segmented.
- Android/iOS native restart and interruption tests remain a separate release gate.

The next migration should add special-section unit kinds only through a versioned cursor/snapshot change. It must not reinterpret an existing chapter cursor silently.
