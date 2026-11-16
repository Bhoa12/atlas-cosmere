# Hoid IA: claim firewall and explicit reading plans

## Purpose

This increment closes two separate safety gaps: provider-authored prose must not be shown merely because it cites an allowed source, and reading recommendations must not invent a universal Cosmere reading order.

## Claim-level explanation path

Use `runAuditedExplanation` for user-facing explanations:

1. Validate the reader's current book and positive chapter.
2. Build the provider context through `buildProviderContext`; only accessible evidence from the exact book and at or before the declared chapter is retained.
3. Build a candidate list from the approved claim ledger. A claim is eligible only when its book matches the current book, its reveal chapter is not later than progress, and every supporting evidence ID exists in the authorized context.
4. Give the provider the question, authorized evidence, and eligible reviewed claim descriptors. The provider returns only a selection of claim IDs.
5. Pass that selection to `renderApprovedClaims`. The selection schema rejects extra fields, including provider-authored prose.
6. Render the canonical `approvedText` values from the local claim snapshot. The provider never supplies user-visible narrative sentences.

A claim record contains an ID, book ID, reveal chapter, kind, evidence IDs, original reviewed text, and `status: "approved"`. Approval is a trust boundary: only a controlled ingestion/review process may create or promote approved claims. Never let a provider write directly to the approved ledger.

The approved text must be an original, concise summary or explanation, not copied EPUB text. Its evidence references must identify accessible source summaries and their book/chapter scope. If a claim cannot be reviewed against the available source material, do not add it to the approved ledger.

This is stronger than citation checking: model-generated prose is not rendered. It is still not a substitute for careful source review when a claim is first approved. A bad or mis-scoped approved claim could itself contain a spoiler; ingestion must verify both factual support and earliest reveal chapter.

## Provider boundary

The selector receives only eligible claims and the authorized evidence. Its result is treated as untrusted data. The selector can choose IDs, but cannot introduce new facts, rewrite approved text, add citations, or extend the chapter limit. Provider exceptions, malformed selections, unknown IDs, duplicate IDs, future claims, foreign-book claims, and missing evidence all fail closed.

Do not use the legacy `runProvider` free-text answer as a user-facing response path. It remains a provenance-checked provider adapter boundary, not a semantic output firewall. For explanations, route through `runAuditedExplanation` and render only its result.

## Metadata-only recommendations

Use `recommendNextInPlan` only with an explicit ordered plan supplied by the reader or application. Every plan entry must refer to a book ID in the supplied catalog allow-list. The function returns the next uncompleted entry after the current book, using only title and order metadata.

It deliberately does not infer a universal Cosmere reading order from the bibliography. If there is no explicit plan, the current book is absent from it, metadata is invalid, or no next entry exists, it abstains. The result contains a reason code, not a narrative justification.

## Privacy and source policy

The supplied private EPUB bibliography is a catalog of source titles and IDs, not proof that every passage is available. Store only metadata, chapter structure, source identifiers, and original reviewed summaries. Do not copy, commit, upload, or send complete EPUB text to providers. If a source passage or chapter mapping is unavailable, leave the corresponding claim absent and abstain rather than infer it.

## Checks

Run:

```sh
npx --yes tsx@4.19.2 src/hoid/claimFirewall.selfcheck.ts
npx --yes tsx@4.19.2 src/hoid/auditedExplanation.selfcheck.ts
npx --yes tsx@4.19.2 src/hoid/readingPlan.selfcheck.ts
npx --yes --package typescript@5.3.3 tsc --noEmit --strict --target ES2020 --module commonjs src/hoid/providerRuntime.ts src/hoid/claimFirewall.ts src/hoid/auditedExplanation.ts src/hoid/readingPlan.ts src/hoid/providerRuntime.selfcheck.ts src/hoid/claimFirewall.selfcheck.ts src/hoid/auditedExplanation.selfcheck.ts src/hoid/readingPlan.selfcheck.ts
```

The checks are executable self-checks, not a claim that the repository's full mobile application has been built or tested.
