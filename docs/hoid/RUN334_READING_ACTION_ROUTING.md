# Run 334 — progress-aware reading action routing

## Objective

Make the three reader actions explicit and separate:

- **Continue** an already-open work from its exact validated edition cursor.
- **Discover** another work only through a currently revalidated, signed editorial path.
- **Reread** a completed work only after the reader explicitly asks for it and names one catalogued title.

This run adds the missing explicit reread path and exposes signed discovery through the conversation router. It does not create a Cosmere chronology or a default reading order.

## Changes

- Extend deterministic conversation intent routing with `reread-request` and `curated-discovery`.
- Add `resolveHoidRereadRequest()`, which:
  - requires an explicit reread cue;
  - matches exactly one normalized title from the metadata-only bibliography;
  - validates the authoritative cursor-v2 progress snapshot;
  - permits a chapter-one reread hint only when the work is explicitly marked completed and its chapter-one manifest unit is verified;
  - reports an in-progress cursor instead of relabelling it as a reread;
  - asks for clarification when no title or multiple titles are present;
  - returns only a manual-selection hint, progress revision and freshness fingerprint.
- Integrate explicit reread requests into HoidScreen without invoking the narrative provider.
- Integrate explicit discovery requests through the host-branded curated-path port. The port reloads and revalidates trust, signed evidence and live progress before the local preference ranker orders the already-authorized projection.
- Keep generic continuation on the existing edition-bound cursor recommendation path.
- Recheck the progress snapshot before the chat response is committed, using the existing progress-scope guard.

## Safety boundaries

- Reader intent is not narrative authority.
- A reread request cannot turn an unstarted or in-progress work into a completed work.
- A completed-work reread result contains no EPUB locator, chapter body, evidence ID, signature or navigation token.
- Reread selection is manual. The resolver does not open an EPUB or mutate the progress ledger.
- Discovery is unavailable without the branded trusted curated-path port and a currently valid signed route/evidence package.
- Local preferences only reorder the already-authorized discovery projection; they cannot add a work or bypass spoiler dependencies.
- If the progress revision/fingerprint changes while the request is running, Hoid discards the response.
- No provider receives raw progress, chapter locators or preference data.
- No private EPUB content, protected passage, narrative summary or new editorial claim is added.

## Source availability

The 24 supplied work identities remain in the metadata-only bibliography. A Library search in this run did not locate `cosmere.epub` or the Roshar EPUBs. Therefore no new source structure or narrative content was inspected or claimed.

## Validation

The dedicated Run 334 workflow runs:

- explicit reread request tests;
- deterministic conversation intent tests;
- reader-preference ranking regressions;
- edition-bound recommendation explanation regressions;
- strict TypeScript checking of HoidScreen and the new contracts.

The workflow result must be read from the final branch HEAD. Earlier passing runs do not certify this change.

## Limitations

- The production curated-path catalogue is still empty and the app entry point does not yet provision the production trust authority. Discovery therefore remains fail-closed until signed routes and the native trust bootstrap are provisioned.
- Reread is a metadata-only, manual-selection affordance. A dedicated reader reset/rewind confirmation flow is not introduced here.
- Physical Android/iOS device QA remains separate from GitHub Actions.
