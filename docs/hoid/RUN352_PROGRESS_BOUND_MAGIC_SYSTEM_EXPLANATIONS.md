# Hoid Run 352 — progress-bound magic-system explanations

## Objective

Introduce a domain-specific explanation adapter for magic-system knowledge. The adapter reuses the existing progress-bound entity dossier gateway and approved editorial claims. It does not create a second narrative store, infer rules from prose, or add provider dependencies.

## Fact model

Magic-system facts are annotations over an already approved dossier claim. Each annotation has:

- a canonical magic-system entity ID;
- one existing dossier claim ID;
- exactly one closed facet: principle, rule, limitation, cost, application, exception or interaction;
- an editorial review record bound to the canonical claim and annotation digests.

The adapter does not accept free-standing explanatory text. Claim wording and citations come unchanged from the approved dossier. A claim with intent `recommend` can never be promoted into a magic-system fact. An interaction facet additionally requires at least two verified participants.

The digest detects changes to the claim, participants, sources or annotation. It is not a digital signature and does not authenticate the reviewer. Production promotion must remain a trusted-host operation.

## Progress and spoiler boundary

For every request the adapter:

1. classifies a magic-system question deterministically;
2. refreshes the durable cursor and compares its revision/fingerprint with the request;
3. resolves the exact system name through the branded local dossier gateway with `kind: "magic"`;
4. validates the dossier identity, mandatory alias evidence, summary source, every claim participant and every chapter citation;
5. selects only reviewed annotations whose claim is present in that authorized dossier;
6. checks the selected book scope and every source unlock watermark;
7. applies the existing explanation-depth budget without truncating dependent facts;
8. projects citations through the existing UI display boundary;
9. refreshes progress again and discards the complete answer if the cursor changed.

Unknown and locked systems return the same neutral `not-found` result. An annotation whose claim is absent from the dossier is skipped because it may be locked or outside the selected work scope. A visible claim with a mismatched review digest invalidates the complete result.

Opening chapter N still authorizes only through the existing completed-through N-1 boundary. Depth changes presentation capacity only; it never widens spoiler authorization.

## Facets

| Facet | Intended classification |
|---|---|
| `principle` | High-level mechanism, only when explicitly reviewed |
| `rule` | A stated operating rule |
| `limitation` | A verified constraint or boundary |
| `cost` | A verified cost or resource requirement |
| `application` | A documented use |
| `exception` | A reviewed exception to a rule |
| `interaction` | A verified interaction with another entity or system |

Facet labels are neutral presentation metadata. They do not alter claim wording.

## Provider and mutation boundary

The adapter accepts only a branded local dossier gateway and a branded fact index. Exact-object validation rejects provider-bearing configuration and shape-compatible untrusted gateways.

It has no provider port, network client, persistence API, graph mutation, progress write, navigation, source-file reader, claim promotion or automatic spoiler authorization. Cancellation and durable-progress freshness are checked around the full operation.

## Production status

`HOID_MAGIC_SYSTEM_FACT_ANNOTATIONS` is intentionally empty. The adapter and synthetic tests are staging infrastructure, not evidence that any real magic-system rules have been reviewed or approved. No real Cosmere magic-system fact or chronology is asserted by this run.

Production use requires original editorial summaries and claims checked against accessible source passages, individually verified chapter metadata, independent review and trusted-host promotion. Private EPUB bytes and protected prose must not be committed.

## Tests

Synthetic tests cover deterministic Spanish/English intent parsing, exact-name routing, magic-kind enforcement, cited output, UI projection, unknown/locked equivalence, recommendation exclusion, annotation digest drift, stale progress, cancellation, provider-bearing configuration and empty production registry behavior.
