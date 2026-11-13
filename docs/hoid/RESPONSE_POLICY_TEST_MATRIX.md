# Hoid IA response-policy test matrix

The final response-policy boundary is intentionally small and deterministic. This document records the minimum regression cases that must remain true as provider adapters and retrieval layers evolve.

## Security invariants

| Case | Expected result |
| --- | --- |
| Evidence is at or before recorded progress | eligible for authorization |
| Evidence is from a future chapter | denied |
| Evidence belongs to a work without recorded progress | denied |
| Chapter is missing, non-integer, or below 1 | denied |
| The same evidence identifier appears twice | only the first eligible occurrence survives |
| No evidence survives filtering | response status is `abstain` |

## Test boundary

The policy consumes only a progress snapshot and evidence references. It does not inspect EPUB text and does not infer narrative facts. A work being present in the private bibliography is therefore not sufficient to authorize an explanation.

Provider implementations must treat the policy output as the maximum allowed narrative support. If no support is authorized, they must not fill the gap with model knowledge; the request must abstain or be reformulated using non-narrative metadata.

## Regression self-check

`src/hoid/responsePolicy.selfcheck.ts` exercises mixed safe and unsafe evidence, duplicate identifiers, invalid chapters, unknown works, and the mandatory abstention path.

The self-check deliberately contains synthetic identifiers only. It stores no protected text and makes no claim that any private passage was consulted.
