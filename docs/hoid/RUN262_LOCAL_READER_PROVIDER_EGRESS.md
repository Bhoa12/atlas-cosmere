# Run 262 — local reader provider egress boundary

## Objective

The EPUB reader extracts chapter blocks locally so the user can read the selected edition. That local reading capability must not become an implicit permission to send chapter text, XHTML, package handles, or file URIs to an external model provider.

Run 262 adds a regression boundary around the existing HoidPipeline provider snapshot. Runtime-only fields attached to a request are deliberately not copied into the provider request.

## Provider request allow-list

The provider request is reconstructed from the canonical answer request and contains only:

- the validated user question;
- the canonical, detached reading positions.

The provider's optional contextual interface receives only the internally retrieved and authorized knowledge projection:

- stable knowledge ID;
- knowledge kind;
- approved summary;
- first safe appearance (book and chapter).

Retrieval aliases, mutable UI state, caller-supplied knowledge context, reader blocks, raw XHTML, EPUB package candidates, local source handles, file URIs and document bytes are not part of this boundary.

## Regression coverage

providerKnowledgeBoundary.test.ts attaches synthetic reader-only fields to a runtime request and verifies that the provider sees exactly question and reading. The test also verifies that the request and reading array are frozen and that a synthetic private-content marker, local file URI and package handle do not appear in the serialized provider request.

The existing provider-context isolation test continues to verify that retrieval aliases are not forwarded and that authorized context snapshots are immutable.

## Security interpretation

This is a defense-in-depth assertion for the HoidPipeline adapter, not a claim that every possible application integration has been audited. New provider integrations must use the same allow-listed snapshot boundary and must not receive the reader component's local chapter state.

The user's question itself remains user-supplied input and is subject to the existing question validation, spoiler guard, evidence authorization and output filtering.

## Privacy and source policy

- No private EPUB is read by these tests.
- No XHTML or copyrighted passage is committed.
- Fixtures use synthetic strings and opaque fake handles.
- Local chapter content remains in the reader UI path.
- Provider knowledge continues to come from internally authorized editorial metadata and summaries, not from raw EPUB extraction.

## Validation

The dedicated workflow runs the provider egress and context-isolation tests and strictly type-checks the pipeline boundary and its dependencies.
