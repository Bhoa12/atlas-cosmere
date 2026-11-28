# Hoid IA Run 386 — progress-bound recommendation envelopes

## Objective

Give every recommendation surface a common, provider-neutral display contract without replacing its specialized trust authority, evidence checks, preference ranking or navigation handoff.

## Recommendation kinds

`src/hoid/recommendationEnvelope.ts` defines three ready variants:

- `resume-reading`: resume only an already-open cursor, or request an explicit choice when several works are active.
- `topic-interest`: recommendations backed by signed, reviewed topic assignments and unlocked claim presentations.
- `curated-path`: recommendations backed by the host-owned signed route catalogue and anti-rollback trust registry.

Every ready envelope carries schema version 1 and one exact progress revision/fingerprint. Topic envelopes additionally carry the closed-set topic IDs selected by the reader and a deterministic selection fingerprint.

## Trust boundaries

- Edition display projections are branded by the existing metadata-only projection function and privately bound to the exact progress revision/fingerprint read from the trusted presentation.
- Topic display projections are branded and privately bound to the progress identity returned by the trusted topic presenter. The envelope also checks that every displayed topic label belongs to the explicit selection.
- Curated-path projections are branded only after the trusted screen port has revalidated the complete signed catalogue, attestations, trust registry, anti-rollback revision and live progress. The screen performs a second authoritative progress read before committing the envelope.
- The envelope constructors accept only these branded projections. A structurally similar object, provider payload or arbitrary display object is rejected.
- Edition cursor, edition hash, EPUB locator, evidence ID, claim ID, signatures, root keys and trust-registry material remain outside React state and outside the envelope.
- The edition navigation target stays in the existing private ref and is independently revalidated immediately before opening the local reader.
- Curated-path selection remains manual; the envelope does not create a chapter target or mutate reading progress.

## Screen integration

`HoidScreen` now stores recommendation envelopes for the three recommendation surfaces:

1. Resume-reading state wraps the existing edition display projection and compares its bound progress scope on every render.
2. Topic-interest state wraps the minimized topic projection, binds it to the explicit topic selection, the trusted presenter identity and the live progress scope.
3. Curated-path state wraps the signed display projection only after a second progress read. A progress race or failed trust check becomes a fixed-copy abstention envelope; no partial route is shown.

The existing recommendation request session still serializes requests, aborts stale work and rejects late completions. Existing navigation handoffs are unchanged.

## Abstention

`createHoidRecommendationAbstentionEnvelope` accepts a closed reason-code set and fixed Spanish copy. It rejects arbitrary text and unknown fields. It does not expose hidden titles, locked chapters, source locators or provider output.

## Provider independence

The new module imports only local contracts, topic taxonomy and a dependency-free SHA-256 helper. It contains no SDK, network client, model selection, credentials or provider-specific payload.

## Bibliography and copyright

The existing 24-work catalogue remains metadata-only. The new tests use synthetic original display text and the existing chapter-index metadata. No EPUB/XHTML bytes, extracted text or copyrighted passages are read, copied or uploaded.

## Validation

The dedicated workflow runs:
- recommendation envelope tests;
- existing recommendation display projection tests;
- trusted HoidScreen integration regressions;
- strict TypeScript for the envelope, projection boundaries, curated host port and HoidScreen.

The run is considered validated only when every job completes successfully on the final branch HEAD.
