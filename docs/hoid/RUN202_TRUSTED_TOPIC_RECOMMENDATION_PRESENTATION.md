# Run 202 — trusted topic recommendation presentation

## Objective

Connect explicit topic-interest recommendations to the same signed editorial
presentation authority used by ordinary Hoid answers. A recommendation may be
selected by the local taxonomy and assignment registry, but its explanatory
text and citations are not renderable until every referenced claim has passed
the host-provided trusted presenter.

## Architecture

- The topic-interest gateway remains provider-neutral. It selects candidate
  works from explicit user-selected topics, approved assignments, the local
  claim renderer and the validated reading snapshot.
- The approved-claim answer port remains local-only. It renders exact approved
  claim IDs and never calls a language provider.
- The trusted topic presenter is the UI-facing trust boundary. It
  canonicalizes recommendation metadata, reloads each distinct approved claim,
  sends it through the trusted screen presenter at brief depth, and rebuilds
  recommendation matches only from the signed presentation segments.
- HoidScreen enables topic recommendations only when this trusted port can be
  constructed. Without the host-injected signed presenter, the feature remains
  disabled. It also clears already-rendered recommendations whenever the host
  replaces the trusted-answer port, so a refreshed trust session cannot inherit
  cached results from the previous authority instance.

## Invariants

1. No recommendation text is shown directly from the topic gateway.
2. Every distinct claim ID is authenticated by the same Ed25519-backed
   presenter used for ordinary narrative answers.
3. Displayed reason text and citations must exactly match the verified claim
   segment.
4. Topic and dimension labels must match the canonical taxonomy.
5. Titles and source IDs must match the metadata-only bibliography.
6. A target work already present in reading progress cannot be recommended as
   unread.
7. Evidence from the recommended target work cannot justify recommending that
   same work.
8. Progress revision and fingerprint must match before and after claim
   verification. A changed or unavailable snapshot withholds the full result.
9. The host presenter owns progress refresh and trust checks; the UI cannot
   provide a more advanced cursor.
10. The verification budget is bounded to twenty distinct claims per request.

## Provider and source policy

This path does not send topic labels, private EPUB data, chapter text or prior
conversation context to a language provider. It uses only claim IDs, local
approved-claim rendering, canonical metadata and the injected trusted
presenter. No EPUB, XHTML, extracted passage or copyrighted text is committed.

## Current production limitation

The application entry point still supplies no production trusted-answer port,
and the production topic-assignment registry remains empty. This change
removes the unconditional code-level block and completes the signed route, but
it does not provision credentials, approve assignments or activate narrative
recommendations in production.

## Validation

The explicit-topic workflow runs the new presenter tests and strict TypeScript
checks. The trusted-screen workflow also includes the new boundary tests.
Keep the pull request in draft until all relevant checks pass on the final HEAD.
