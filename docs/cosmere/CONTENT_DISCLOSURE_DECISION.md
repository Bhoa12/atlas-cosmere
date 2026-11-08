# Content Disclosure Decision

`resolveContentDisclosureDecision` is a presentation-safe adapter over the existing disclosure gate.

It converts structural outcomes into stable reasons without carrying narrative text:

- `ready`: evidence and explicit reading prerequisites permit disclosure.
- `missing-reading-progress`: the evidence gate passed but explicit prerequisites are incomplete.
- `insufficient-evidence`: the requested evidence level is not available.
- `invalid-request`: malformed or inconsistent input is blocked.

The adapter intentionally does **not** reveal missing unit identifiers, spoiler descriptions, source passages, or inferred editorial structure. It does not create evidence, infer prerequisites, or relax the underlying fail-closed policy.

This keeps UI feedback useful while preserving the separation between provenance, progress, anti-spoiler authorization, and narrative content.
