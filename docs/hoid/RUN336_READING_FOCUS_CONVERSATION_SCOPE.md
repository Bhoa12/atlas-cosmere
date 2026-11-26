# Hoid Run 336 — conversation scope derived from reading focus

## Objective

Use the Run 335 reading focus as a deterministic, progress-bound narrowing constraint for narrative conversation turns. The user should not have to restate the active book on every question, and Hoid must not guess when several works are active.

## Behaviour

- **Automatic mode, one active work:** resolve the only active work and pass a canonical `single-work` book scope to the trusted answer host.
- **Automatic mode, multiple active works:** return `selection-required`. The reader must choose the focus in HoidScreen; array order, recency and series order are never used.
- **Automatic mode, explicit focus:** the selected work must still exist in the authoritative cursor-v2 progress snapshot and have a verified chapter manifest.
- **Explicit single-work mode:** the selected catalogue work must be active and verifiable. Selecting an unstarted work does not grant access.
- **Explicit cross-work mode:** two to four selected works are accepted only when every selected work has active, verifiable progress. Each work remains subject to its own chapter-level evidence gate.

Selecting a focus clears the existing conversational transcript and resets the trusted conversation context. This prevents follow-up references from one work being carried into another. A changed progress revision/fingerprint invalidates the focus and existing progress-scoped messages through the existing screen lifecycle.

## Provider and trust boundary

The focus projection is local metadata. It is **not** passed to a language-model provider. The screen passes only the existing canonical `bookScope` to the trusted conversation port. No chapter number, cursor, EPUB locator, progress fingerprint, evidence identifier, signature, protected passage or local preference is added to a provider payload.

The trusted answer host remains authoritative. It must independently validate every exact-unit claim, signed editorial approval and per-work progress boundary. The book scope only narrows eligible sources; it cannot unlock chapters or create evidence.

## Failure policy

The resolver fails closed for invalid progress, missing active work, stale focus selection, unverified chapter segmentation, malformed scope arrays, accessors and contradictory request fields. A multiple-work automatic request does not dispatch to the narrative host until a focus is explicitly selected. Cross-work comparison is always an explicit mode and requires two to four active works.

## Tests

`src/hoid/readingFocusConversationScope.test.ts` covers automatic focus, multiple-work ambiguity, explicit focus selection, stale selections, unstarted works, single-work and cross-work modes, accessor-backed input, invalid progress and data minimization.

## Source policy

This run adds no narrative claims and does not read or upload private EPUB content. The existing metadata bibliography and verified edition manifests remain the only structural inputs. Source availability must be established before any new narrative assertion is introduced.
