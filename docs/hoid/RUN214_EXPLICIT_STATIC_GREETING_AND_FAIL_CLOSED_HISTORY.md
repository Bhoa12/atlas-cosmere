# Run 214 — explicit static greeting and fail-closed conversation history

## Finding

The conversation-history filter treated every Hoid message without a
`progressScope` as visible. The original exception was intended for the
static greeting and neutral compatibility notices, but it also admitted any
legacy assistant message with no progress identity.

That is not a safe compatibility rule: old narrative text may have been
generated under a different reading position, before progress-scoped
presentation existed, or under a less strict runtime.

## Changes

- Introduce the exact `HOID_STATIC_GREETING_ID` and
  `HOID_STATIC_GREETING_KIND` markers.
- Keep the initial greeting visible only when both own data properties match
  those constants.
- Hide every other unscoped Hoid message, including legacy assistant text.
- Continue to show user-authored messages independently of reading progress.
- Require every scoped assistant message to match the live revision and
  SHA-256 progress fingerprint exactly.
- Scope neutral fallback/error responses to the request snapshot so they are
  visible only while that same progress identity remains current.
- Keep stale and cancelled responses unscoped; the history filter therefore
  hides them.
- Reject accessor-backed greeting markers without invoking getters.
- Add the history policy and tests to the conversation-continuity workflow's
  path filters and strict TypeScript check.

## Security invariants

1. Absence of a progress scope never implies that an assistant message is safe.
2. Only the one explicitly identified static greeting is exempt from progress
   scoping.
3. A valid scope must match both revision and fingerprint.
4. User messages remain visible after a progress change; assistant answers do
   not.
5. A response generated under an old cursor cannot reappear as legacy text.
6. Stale or cancelled output loses citations, segments, layout and evidence
   metadata before it is appended.
7. No provider output can assign itself the static-greeting marker; the screen
   creates that marker only for its fixed initial greeting.

## Validation

The dedicated conversation-continuity workflow runs:
- coreference, entity, relationship and conversation gateway regression tests;
- the conversation history policy suite;
- strict TypeScript checks for the policy and HoidScreen integration.

The PR must remain draft until the final HEAD has successful CI.

## Scope and privacy

This run changes only message visibility metadata and its validation. It adds
no Cosmere facts, aliases, summaries, source locators, EPUB/XHTML content,
extracted passages or images. It does not change the reader's progress,
bibliography, editorial registries, trust keys or production approvals.
