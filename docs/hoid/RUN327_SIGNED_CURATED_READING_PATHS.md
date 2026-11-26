# Run 327 — signed curated reading paths

## Objective

Run 326 deliberately removed unreviewed cross-work discovery. This change adds the missing contract for a future editorially curated reading-path catalogue without inventing any Cosmere order.

The production catalogue exported by `HOID_CURATED_READING_PATH_CATALOGUE` is intentionally empty. The fixtures in the test suite are synthetic and are not reading recommendations.

## Catalogue contract

A catalogue is immutable, revisioned and fingerprinted. Each path contains an explicit ordered list of distinct works. Every step after the first must declare:

- one or more prerequisites that point only to earlier step IDs;
- an exact edition-bound chapter reference for the completion threshold of each prerequisite;
- at least one rationale-evidence reference from a prerequisite work, at or before that prerequisite's completion threshold;
- original editorial rationale, which is included in the signed catalogue fingerprint.

A path cannot infer dependencies from bibliography order, publication order, chronology, a model response or an unverified source. References are validated against the current edition manifests. Duplicate chapter labels remain identified by exact unit identity.

## Approval and trust

The canonical signing payload is domain-separated and binds:

- catalogue ID and revision;
- the complete catalogue fingerprint (including every path, step, prerequisite and rationale);
- reviewer ID, decision, review timestamp and key ID.

Approval requires at least two distinct reviewer identities and two distinct key IDs. Every signature is checked through the existing root-authenticated reviewer trust registry and the injected Ed25519 verification port. Repository authorization, key validity, revocation, registry expiry and minimum registry revision remain enforced by the shared signature verifier.

A signed rejection vetoes the entire catalogue. Missing, malformed, stale or unverifiable approvals fail closed. The route module creates no keys and does not treat a caller-supplied `approved` flag as authority.

## Progress evaluation

For every prerequisite, Hoid checks the exact `HoidChapterReference` against the live v3 unit-progress ledger.

The current cursor is not considered completed. A prerequisite at ordinal N is satisfied only when the verified cursor's completed-through ordinal is at least N, or the work is explicitly marked complete. This prevents a cursor currently on the prerequisite chapter from unlocking the next work.

Only the first eligible, unstarted step in each approved path is returned. If a target work is already in progress, the path does not recommend a second start; the existing resume-current-work flow remains responsible for it.

## Navigation and provider boundary

A route recommendation is book-level metadata only:

- it contains no chapter cursor, locator, EPUB path or chapter number;
- its navigation mode is always `manual-reader-selection-required`;
- it never calls an AI provider;
- it never changes progress;
- it never unlocks narrative evidence.

Starting a new work remains an explicit reader action. The recommendation handoff introduced in Run 326 continues to reject unstarted works, including chapter one.

The rationale is exposed only after all declared prerequisites have been completed and the signed catalogue has passed quorum verification. The plan is bound to catalogue fingerprint, progress revision/fingerprint and trust-registry revision. The caller must re-evaluate it before presentation; the validation function does so and compares the complete canonical plan.

## Deliberate non-goals

- No real Cosmere or Roshar route is populated.
- No publication, chronological or fandom reading order is asserted.
- No EPUB or chapter body is read.
- No narrative summary, passage, spoiler claim or source content is added.
- No reviewer keys are generated or stored.
- No production promotion or database write occurs.
- No HoidScreen integration is activated in this run.

## Validation

`src/hoid/curatedReadingPathCatalogue.test.ts` uses synthetic route fixtures and a test-only Ed25519 port stub. It validates the route contract, signature message binding, two-reviewer quorum, rejection veto, exact chapter completion boundaries, stale-plan rejection, and the absence of direct chapter navigation.

The stub is not a production trust implementation. Production composition must inject the existing real Ed25519 verifier with a current root-authenticated reviewer registry.
