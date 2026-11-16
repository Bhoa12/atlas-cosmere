# Hoid provider runtime

This module is the provider-independent execution boundary for Hoid IA. Provider SDKs and credentials remain in adapters outside this module.

## Context authorization

A provider is called only after the runtime validates:

- a non-empty question (maximum 4,000 characters);
- an explicit `explain` or `recommend` intent;
- a valid book identifier and positive, safe-integer chapter;
- evidence identifiers and metadata;
- exact book equality, explicit accessibility, and chapter not later than the reader's declared progress.

The runtime drops evidence from other books, future chapters, and inaccessible sources. It rejects ambiguous duplicate evidence identifiers. It caps the input at 200 evidence records, the authorized context at 40 records, each original summary at 3,000 characters, and the total context at 24,000 characters.

Only the question, intent, declared progress, evidence identifiers, chapter metadata, and original summaries cross the provider boundary. Complete EPUB text is not part of this contract.

## Provider output validation

The provider result is treated as untrusted runtime data, even when its TypeScript adapter claims to implement the interface. The runtime validates the discriminated result shape, answer size, non-empty text, and every evidence identifier. Empty, duplicate, malformed, or unauthorized citations fail closed.

The authorized evidence identifier set is snapshotted before provider execution. The context and its nested evidence are frozen, so a provider cannot expand its own citation allow-list by mutating the object it receives. Provider exceptions and malformed results become structured abstentions.

## Security limits that must remain explicit

An authorized citation proves only that the provider named an evidence item in the allowed context. It does **not** prove that every sentence is entailed by that summary, nor that a model has not introduced a spoiler from its latent knowledge. This runtime is a provenance and boundary check, not a semantic spoiler detector.

Before user-facing release, Hoid must add a separate claim-level review stage that checks each factual claim against the cited original summary and the same book/chapter scope. If that review cannot establish support, the entire answer must be withheld. Do not describe citation validation alone as a guarantee of spoiler-free prose.

## Checks

Run the executable self-check:

```sh
npx --yes tsx@4.19.2 src/hoid/providerRuntime.selfcheck.ts
```

The check covers authorized filtering, future/foreign/inaccessible evidence, invalid progress and oversized questions, duplicate identifiers, valid provenance, unknown citations, malformed abstentions, attempted provider mutation, provider exceptions, and empty authorized context.

A GitHub Actions workflow runs the self-check and a strict TypeScript check for these files.
