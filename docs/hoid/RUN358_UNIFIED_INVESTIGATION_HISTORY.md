# Run 358 — unified, progress-scoped investigation history

## Purpose

Run 358 generalizes the ephemeral investigation session introduced in Run 357.
The session now records verified investigations across five independent domains:

- `character-evolution`: overview and the eight reviewed character dimensions.
- `magic-system`: overview and the seven reviewed magic facets.
- `entity-dossier`: overview of one resolved entity.
- `entity-relationship`: a verified pairwise relationship.
- `entity-timeline`: a reading-order evidence timeline for one entity.

A domain/topic pair is part of the identity of a completed investigation. The
same subject can therefore be researched independently as a character, magic
system, dossier, relationship participant, or timeline subject without one
result suppressing another.

## Completion authority

The screen records an investigation only after the adapter returns `ready`
and the final progress refresh confirms the same request revision, progress
fingerprint, and selected book scope. Cancelled, stale, blocked, malformed,
not-found, and unavailable results are never recorded.

The session ticket must still be current at commit time. A superseded request
cannot add history.

## Privacy and lifecycle

The session remains in-memory and screen-scoped. It stores only:

- SHA-256 fingerprint of the normalized subject label;
- validated domain and topic;
- progress revision and fingerprint;
- reading-scope fingerprint;
- monotonically increasing in-session sequence.

It does not store question text, answer text, EPUB text, locators, evidence IDs,
provider payloads, or raw subject labels. A hash is pseudonymization, not
irreversible anonymization.

The existing 64-entry bound and reset behavior remain. Progress, focus, scope,
screen teardown, and conversation reset continue to invalidate the session
according to the existing host lifecycle. No persistent storage or migration
is introduced.

## Recommendation filtering

Character follow-up suggestions continue to use the `dimension` contract.
Other domains may use a `topic` contract. The session validates each against
the selected domain taxonomy and suppresses only a completed topic for the
same subject, progress revision/fingerprint, and exact reading scope.

## Bibliography and editorial boundary

The source catalogue remains the verified private EPUB bibliography supplied
by the user. This change adds no narrative claims, summaries, source passages,
or production annotations. It changes only how already-approved investigations
are remembered during the current screen session.

## Validation

The Run 358 workflow executes the session tests and adjacent dossier,
relationship, timeline, magic-system, character-evolution, answer projection,
and intent suites, followed by strict TypeScript checking of the changed
contracts and screen integration.
