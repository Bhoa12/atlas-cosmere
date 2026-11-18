# Hoid progress-bound explanation gateway

## Purpose

`explanationGateway.ts` is the application boundary for multi-hop, evidence-backed relationship explanations. It composes the existing authorized graph planner and exact-claim renderer without introducing an AI-provider dependency.

The public request contains only:
- the authoritative cursor-native v2 progress snapshot;
- a source entity ID;
- a destination entity ID;
- optional bounded traversal limits.

It does not accept caller-authored prose, provider output, a prefiltered graph, or arbitrary evidence records.

## Execution

1. Canonicalize the request envelope and query as plain own-data-property records. Unknown fields, symbols, accessors, malformed IDs and out-of-range bounds are rejected.
2. Validate the supplied v2 snapshot and derive its progress revision/fingerprint.
3. Read the host's current authoritative progress and require an exact revision/fingerprint match before planning.
4. Build a graph query plan through the injected trusted engine. The production factory binds this step to `createProductionHoidExplanationPlan()`, which reads only source-controlled relation definitions and the approved editorial registry.
5. Require the plan's progress identity to equal the request identity.
6. Render through the local renderer. Production uses `renderProductionHoidExplanationPlan()`, which accepts only a plan created by the same module instance and resolves exact statements from `HOID_APPROVED_CLAIMS`.
7. Validate the rendered envelope and require its text to be exactly the ordered concatenation of its cited editorial segments.
8. Read authoritative progress again. Any change discards the entire explanation.

The gateway is synchronous and provider-independent. The two progress reads protect the composition boundary and provide a stable contract if the host later adds asynchronous planning or persistence.

## Output

A successful result contains:
- exact locally approved editorial text;
- one segment per approved claim;
- evidence IDs and edition-bound citations per segment;
- the graph plan ID;
- the progress revision and fingerprint;
- the graph traversal truncation indicator.

A no-path result intentionally does not distinguish a locked entity from an absent or disconnected entity. This prevents the query endpoint from becoming an existence oracle for future knowledge.

Failures return an opaque unavailable reason and never return partial segments or provider-authored prose.

## Trust and composition

`createProductionHoidExplanationGateway()` is the production composition root. It binds the source-controlled production graph and renderer. The lower-level `createHoidExplanationGateway()` accepts a trusted local engine port for tests and controlled dependency-injection composition; it is not a way to trust arbitrary provider code.

The production graph definition and approved claim registry are currently empty. Therefore the production gateway correctly returns `no-path` for every relationship query until independently reviewed source-controlled knowledge is promoted. Synthetic fixtures exercise the successful path but do not assert Cosmere facts or change the production registry.

## Spoiler policy

The graph builder authorizes every endpoint and every evidence item against the same validated v2 progress projection. A cross-work edge is withheld unless all evidence works have crossed their exclusive chapter-completion boundaries. The renderer checks the plan's progress identity again and rechecks each source's unlock threshold. The gateway additionally compares the authoritative progress before and after the full operation.

An open chapter N authorizes only through N-1. Explicit reader-declared completion is the only state that unlocks the entire work. Progress in one book never unlocks another book.

## Limits

- Directed simple paths only; inverse relations are never inferred.
- Maximum depth: 6.
- Maximum paths: 10.
- Fixed graph expansion budget in the graph-query module.
- Maximum rendered segments: 50.
- Maximum rendered sources: 512.
- No free-form model-authored connective prose.
- No production registry writes, PR merges or progress mutations.

See `KNOWLEDGE_GRAPH_QUERIES_AND_EXPLANATIONS.md` for graph semantics and `READING_BOUNDARY_POLICY.md` for the chapter N to N-1 rule.
