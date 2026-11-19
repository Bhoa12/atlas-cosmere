# Run 163 — deterministic progress-freshness CI repair

## Scope

This follow-up is based on the exact Run 162 head
`012ada13bbc705f52401dfd7b57c10aa2ea18f23`. It changes only test harnesses
and this document. It does not alter production progress, conversation, entity,
recommendation or spoiler-policy code.

## Findings from Run 162 CI

Two checks failed on the PR merge commit:

1. The progress-freshness suite passed all 82 Vitest tests, but strict TypeScript
   rejected optional resolver variables assigned only inside Promise executors.
   TypeScript narrowed the optional call at the later invocation to
   `never` (`TS2349`).
2. The typed-conversation continuity suite had one timeout in the deferred
   runtime test. The test changed its progress fixture immediately after
   calling the asynchronous gateway. The gateway's initial async progress read
   yielded before invoking the strict runtime, so the deferred resolver had not
   yet been assigned when the test tried to complete it.

These were test-harness failures, not evidence that the runtime accepted stale
progress. They nevertheless prevented the branch from being considered
validated.

## Changes

- Use definite-assignment callback declarations for the test-only load gate,
  making the Promise-executor initialization explicit to strict TypeScript.
- Add a separate `runtimeStarted` signal to the typed follow-up regression.
- Await the runtime-start signal before mutating the authoritative progress
  fixture and resolving the deferred answer.
- Preserve the assertion that a progress change while the runtime is genuinely
  pending withholds the complete answer.
- Do not increase global test timeouts, weaken freshness checks or modify
  production behavior.

## Required validation

The new HEAD must pass:

- `cursorProgressCoordinator.test.ts` and strict TypeScript;
- `typedConversationGateway.test.ts` and its dependent continuity suites;
- the full progress-freshness, spoiler-safe conversation, typed entity and
  cross-book recommendation workflows;
- strict TypeScript checks that include the React Native screen/context
  composition.

A successful Vitest run alone is insufficient if strict TypeScript or the
dependent workflows fail. Report the exact final HEAD and completed check
results; do not infer success from Run 161 or Run 162 runs.

## Safety and isolation

- The base is the exact Run 162 commit above.
- No changes are made to `main`, Run 162 or any earlier branch.
- No EPUB, XHTML, chapter text, private URI, reading-progress export or
  narrative claim is added.
- No production knowledge, progress or activation receipt is written.
- The PR must remain draft and must not be merged automatically.
