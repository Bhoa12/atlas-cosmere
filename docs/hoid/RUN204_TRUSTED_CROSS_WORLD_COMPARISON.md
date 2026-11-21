# Run 204 — trusted cross-world comparison presentation

## Finding

The previous cross-world comparison helper accepted caller-supplied progress and
pre-rendered evidence answers. It checked chapter scopes and assignment metadata,
but it did not route each claim through the host-owned Ed25519 answer presenter,
did not refresh SQLite progress around the operation, and did not re-resolve the
activation receipt after presentation.

That helper is useful as a deterministic editorial/test utility, but it is not
a production presentation authority.

## Change

`createHoidTrustedTopicComparisonPresenter()` adds a host-owned presentation
port with the same trust requirements as ordinary answers and topic
recommendations.

The request contains only:

- one canonical topic ID;
- one canonical dimension ID;
- two to four distinct subject IDs of the same subject kind.

It does not accept progress, world IDs/labels, claim prose, answer objects,
citations or provider-authored comparison text.

## Authorization sequence

1. Read the current v2 cursor snapshot from the host-owned durable progress port.
2. Resolve the active topic-assignment registry and its activation receipt.
3. Validate the registry against approved claims and verified knowledge.
4. Resolve each subject to exactly one assignment for the requested topic/dimension.
5. Enforce each entity's first-safe-appearance boundary and require work subjects to be explicitly completed (the current work-assignment schema has no chapter-scoped first-safe marker).
6. Load only the assigned claim IDs through the local approved-claim loader.
7. Present every distinct claim through the shared trusted Ed25519 answer port.
8. Rebind exact claim text digest, evidence IDs and citations to the validated assignment/evidence registry.
9. Refresh progress and the assignment activation receipt again.
10. Return a side-by-side comparison only if both authorities are unchanged.

A missing, malformed, inactive, changed or unavailable authority withholds the
whole comparison. A progress revision/fingerprint change also withholds it.
The result contains no inferred relationship: `mode = side-by-side` and
`inference = none`.

## Production boundary

The new presenter defaults to `resolveProductionHoidTopicAssignments()` and
`validateHoidTopicAssignments()`. Optional resolver/validator injection is a
trusted host/test composition seam only; it must never be derived from request,
provider or UI data.

The old `compareHoidTopicsAcrossWorlds()` remains available for deterministic
editorial fixtures and low-level validation tests. It is explicitly not a UI
or production authority. The old production convenience entry point now
abstains unconditionally so future registry activation cannot accidentally
turn the unsigned helper into a presentation bypass.

## Tests

The dedicated suite covers:

- signed, assignment-bound side-by-side output;
- rejection of provider prose and caller-supplied progress;
- inactive or malformed assignment authority;
- unknown subjects and mismatched assignment tuples;
- claim digest and evidence-citation binding;
- signed presenter abstention;
- progress changes during presentation;
- activation receipt changes during presentation;
- entity first-safe-appearance and explicit work completion;
- same-world results;
- malformed receipts and accessor rejection.

## Production status and privacy

The checked-in assignment registry and activation receipt remain empty. The
production presenter therefore abstains until independently reviewed and
activated records exist. Synthetic assignments and signing outputs are test
fixtures only. No EPUB/XHTML body, extracted passage, private source path or
copyrighted narrative text is committed.
