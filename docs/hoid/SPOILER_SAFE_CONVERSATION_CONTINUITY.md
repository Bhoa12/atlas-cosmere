# Run 134 — spoiler-safe conversational continuity

## Purpose

Run 134 adds narrow conversational continuity for follow-up questions about an already resolved relationship group. The goal is to support natural turns such as “¿Y entre ellos?” without retaining or replaying a prior narrative answer.

## Context contract

The context is versioned and contains only:

- schema version;
- context kind;
- two to four canonical entity IDs;
- the exact SQLite v2 progress revision;
- the exact progress fingerprint.

It does not contain user text, entity names, matched aliases, claim text, summaries, evidence prose, source passages, provider output or citations. It is held in a component-local React ref and is not persisted, synchronized or included in chat messages.

## Follow-up recognition

The resolver uses a deterministic allowlist of group-level relationship phrases. It does not use a model, embedding, fuzzy matching or a general coreference engine.

Singular pronouns and demonstratives (for example, “¿Y ella?” or “¿Y el otro?”) are rejected as ambiguous because the reviewed entity registry does not currently carry a verified grammatical-gender/coreference model. Missing or malformed context also blocks the request. An unrelated question is routed normally and does not receive the old context.

## Reauthorization

A recognized follow-up passes only the stored entity IDs to the relationship gateway. The gateway revalidates them against the current production registries:

- entity identity and kind;
- first-safe-appearance source;
- source document digest;
- entity evidence unlock;
- at least one approved alias record and all of that record's evidence unlocks.

The resolver preserves the previous entity order. The graph is queried again; previous answer text, claims, citations and paths are not replayed.

## Progress binding and invalidation

The context is valid only for the exact progress revision and SHA-256 fingerprint that created it. A changed revision or changed fingerprint blocks the follow-up before entity or graph resolution. HoidScreen clears the ref on progress changes, unrelated turns, reading-progress/recommendation routes, errors, stale commits and failed presentation. Application restart clears it naturally.

The conversation gateway also checks the current progress before and after asynchronous work. The screen performs its existing final pre-commit comparison and clears context if the response becomes stale.

## Failure behavior

- Ambiguous singular reference: abstain with an opaque context reason.
- Missing context: abstain; do not call the general answer runtime.
- Stale context: abstain and require the user to name the entities again.
- Unknown, locked or no-longer-authorized entity ID: the relationship gateway blocks the complete group.
- Missing graph path: no partial relationship explanation.
- Invalid progress or resolver failure: fail closed.

## Tests

The continuity suite covers ID-only context construction, accessor and array-shape rejection, group follow-up recognition, ambiguous pronouns, missing context, stale revision/fingerprint, and unrelated-question isolation. Entity resolver tests cover ID revalidation and work-local disclosure. Relationship and conversation gateway tests verify that follow-ups reuse only IDs and never invoke the general runtime.

## Source and privacy boundary

This change uses only canonical entity IDs and existing reviewed registries. It does not inspect new EPUB chapters, store narrative text, or add private EPUB/XHTML content, protected passages or images to the repository. No production knowledge or reading progress is modified.
