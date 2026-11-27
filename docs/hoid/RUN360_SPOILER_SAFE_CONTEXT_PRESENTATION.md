# Run 360 — spoiler-safe investigation context presentation

## Purpose

Run 359 produced an opaque, evidence-linked context plan. Run 360 adds the only supported user-facing projection for those links. It resolves entity labels through the independently reviewed alias-disclosure registry, not through the entity's first-appearance metadata or an LLM.

## Alias disclosure is a separate fact

An entity's first safe appearance does not authorize every later name, identity, title, or alias. The presenter therefore requires:

- the entity's summary/source to be unlocked at the current cursor;
- a separate approved alias record for the exact spelling;
- every source and unlock requirement in that alias record to be satisfied;
- all alias and relation sources to remain inside the selected book scope;
- the alias fingerprint to match a completed investigation in the same progress revision and scope;
- the alias to resolve to exactly one entity across the currently disclosed catalogue.

A missing, locked, ambiguous, or out-of-scope alias withholds the affected presentation. It does not reveal which hidden alias caused the rejection.

## Contracts

- \`resolveHoidAuthorizedEntityAliasDisclosures\` creates a locally branded projection of visible labels and chapter-level source metadata.
- \`createHoidInvestigationContextPresenter\` accepts only a locally branded knowledge graph, the current history and selected book scope.
- The presenter reads progress before planning and again immediately before returning. A changed revision or fingerprint invalidates the complete result.
- The presenter emits original deterministic Spanish explanations and follow-up questions. It never accepts provider-authored labels, claims, prose, or citations.
- Relation sources and label-disclosure sources are distinguished in the presentation.

## Privacy and copyright

The output excludes entity IDs, alias-record IDs, claim IDs, evidence IDs, locators, document hashes, and source text. It contains only labels whose independent disclosure records are unlocked, original explanation text, and book/chapter metadata. No EPUB/XHTML text is copied or uploaded.

## Production readiness

The production editorial knowledge, approved-claim and alias registries remain empty until original annotations are checked against accessible private source documents and reviewed. Synthetic fixtures validate contracts only; they are not Cosmere facts. Consequently, the production presenter correctly returns no narrative links today.

## Validation

The dedicated workflow runs alias-resolution, graph, context-planning and presentation tests plus strict TypeScript checks. The feature is not considered validated until Actions completes successfully on the final branch HEAD.
