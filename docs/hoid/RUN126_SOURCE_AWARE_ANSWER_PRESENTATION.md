# Run 126 — Source-aware answer presentation

## Purpose

The strict evidence runtime already returns exact locally approved claim text and edition-bound evidence citations. The chat screen previously rendered only the answer text, leaving the reader unable to inspect which work and chapter supported the response.

Run 126 adds a presentation boundary between the evidence runtime and the React Native chat UI.

## Contract

presentHoidEvidenceAnswer(input, progress) accepts an untrusted runtime result and the authoritative cursor-native v2 progress snapshot.

An authorized result is displayable only when:

- Its object shape is exact and accessor-free.
- Claim IDs and evidence IDs are bounded, unique identifiers.
- Evidence IDs and citation IDs match exactly.
- Every citation references a known work in the metadata-only bibliography.
- The source and unlock belong to the same work.
- The unlock chapter is not earlier than the cited source chapter.
- The authoritative progress snapshot is valid.
- Every cited unlock threshold has been completed.

The returned text is the exact approved text supplied by the evidence runtime. The presentation layer does not rewrite, summarize, extend or ask a provider to author it.

## Failure behavior

Blocked, abstained, malformed, stale or locked results return a generic withheld response. Raw runtime/provider text is never echoed for non-authorized states. No citation is returned when any source fails validation.

## UI behavior

HoidScreen renders a compact source list below an authorized answer, showing the bibliography title and source chapter. Citations are attached to the same progress revision/fingerprint as the answer, so the existing history invalidation policy removes both together after any reading-progress change.

## Limits

This layer validates the runtime answer envelope and citation metadata. It does not create editorial approvals, populate the production registry, infer missing source passages or activate the graph explanation engine. The production editorial registry remains the authority for what can be answered.

No EPUB, XHTML body, extracted passage or protected book text is stored in this feature.
