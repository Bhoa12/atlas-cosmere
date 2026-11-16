# Hoid IA — Evidence Selection Runtime

## Purpose

`HoidEvidenceRuntime` is the strict application path for new narrative responses. It separates model-assisted selection from editorial authorship:

1. Hoid validates the question and reader progress.
2. Hoid retrieves only verified evidence unlocked in the exact source works and chapters.
3. The runtime builds candidates from locally stored, approved original-editorial claims.
4. A provider may return only candidate claim IDs.
5. Hoid renders the exact text from the local approved registry.

The provider cannot author, rewrite, append, or reorder narrative prose.

## Editorial claim contract

Every claim must contain:

- a stable claim ID;
- original editorial text (not copied source prose);
- an intent: `explain`, `recommend`, or `context`;
- one or more evidence IDs;
- an approval record with `status=approved`, `origin=original-editorial`, reviewer ID and review timestamp.

Every evidence ID must resolve to a valid Hoid knowledge entry. That entry must have a known bibliography source, a book/chapter first-safe appearance, verified provenance and an original summary before it can be retrieved.

The approval fields are governance metadata, not an automatic proof of correctness. The editorial process must verify each claim against an accessible source before marking it approved.

## Multi-book authorization

A claim is a candidate only when **all** its evidence IDs are present in the request's authorized retrieval context. A cross-book explanation therefore remains unavailable until the reader has reached every evidence position needed by that claim.

Unknown book IDs are ignored for authorization. Duplicate or malformed progress is rejected. Evidence with `limited` or `unavailable` provenance never enters the provider context.

## Provider contract

The provider receives:

- the normalized question;
- the requested intent;
- a bounded list of approved candidate IDs, original claim text and evidence IDs.

It returns only a string array of claim IDs. Any unknown, repeated, malformed or excessive selection is rejected. The runtime never displays arbitrary provider text.

The selector is provider-neutral and can be implemented by a remote model, local model or deterministic component. No SDK, key or network client belongs in this module.

## Recommendations

The runtime exposes metadata-only recommendations through the existing bibliography. These identify unstarted works only; they do not infer canonical reading order, plot dependencies or narrative facts.

## Failure policy

The runtime abstains when:

- no approved claim has fully authorized evidence;
- no selector is configured;
- the selector fails or times out;
- the selector returns invalid IDs;
- the input or progress cannot be validated.

It never falls back to model prior knowledge or free-form completion.

## Integration status and limitations

This is a new strict runtime and does not yet replace the compatibility paths in `HoidService` or `HoidPipeline`. Those older paths retain different text-provider contracts and must not be treated as equivalent to ID-only claim selection.

The current `HoidScreen` still constructs `new HoidService()` without a provider. Consequently, the application UI is not yet connected to a live IA provider through this runtime. This change deliberately does not add credentials, a concrete provider SDK, or fabricated editorial data.

The private bibliography supplied by the user remains a metadata-only source catalogue. No EPUB text or extracted passage was added. The runtime is ready to receive original editorial claims only after their source passages and chapter positions have been verified in the available environment.

## Next integration steps

1. Build an editorial claim repository with versioned review metadata and evidence IDs.
2. Ingest only verified book/chapter structure and original summaries from accessible private sources.
3. Add a provider adapter implementing `HoidClaimSelector` without allowing it to return prose.
4. Inject the runtime at the application composition root and migrate `HoidScreen` away from the legacy service.
5. Add persistence and revision control for reader progress before enabling cross-session answers.
