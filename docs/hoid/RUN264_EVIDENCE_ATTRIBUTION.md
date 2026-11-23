# Run 264 — Evidence-attributed answers

## Objective

Expose verifiable, edition-bound source references alongside factual claims returned by Hoid's evidence-aware provider path. This gives the UI enough metadata to explain where a claim is grounded without copying EPUB passages or trusting source labels supplied by a provider.

## Provider context

Authorized context entries now include an `evidenceSource` pair containing only the verified bibliography work ID and chapter number. The pair is reconstructed locally through `evidenceCitationFor()`, which checks the evidence source, unlock watermark and exact reading manifest.

Private EPUB locator IDs are not sent to the provider. Retrieval aliases remain local. Source metadata is included in the context character budget.

## User-facing answer contract

`HoidAnswer` now optionally exposes immutable `claims` for the evidence-bound provider path. Each claim contains its validated text and one or more citations with:

- evidence identifier;
- knowledge kind;
- canonical bibliography work ID and title;
- verified source chapter.

The pipeline maps provider-returned evidence IDs back to the local authorized context and bibliography. It never accepts a provider-supplied book title, chapter number, locator or URL as citation metadata.

The exact locator is used only by the local `evidenceCitationFor()` validation and is omitted from both provider context and the user-facing answer object.

## Fail-closed behavior

- Claims with missing or unauthorized evidence IDs are discarded by the existing claim filter.
- If no fully authorized claim remains, the answer is blocked.
- If any accepted evidence ID cannot be mapped to a canonical source citation, the answer is blocked.
- Citation metadata is attached only after output spoiler checks and alias-progress witness revalidation succeed.
- Legacy free-form providers continue to work for compatibility, but no citations are fabricated for them.

## Privacy and copyright

This change uses only metadata already present in the verified editorial catalog and reading manifests. It does not read private EPUB files, store chapter text, expose XHTML, or copy protected passages. Editorial summaries remain original catalog data and are not copied into the answer citation object.

## Regression coverage

The dedicated suite verifies:

- a claim is attributed to the exact verified book and chapter;
- a cross-work claim receives citations from both authorized works;
- provider-supplied source labels and locators are ignored;
- unsupported claims fail closed;
- legacy providers do not receive fabricated citations;
- output citations omit private locators and editorial summary text.

All fixtures are synthetic and use metadata from existing verified manifests.

## Validation

The dedicated GitHub Actions workflow runs the evidence-attribution integration suite and strict TypeScript checking for the pipeline, context budget, answer contracts and test.
