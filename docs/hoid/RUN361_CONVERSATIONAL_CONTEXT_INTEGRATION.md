# Run 361 — conversational integration for accumulated context

## Purpose

Run 360 introduced a spoiler-safe presenter, but it was not connected to the chat flow. Run 361 adds a production conversation boundary and attaches its safe output to the exact answer that completed the investigation.

## Architecture

- `createProductionHoidInvestigationContextConversationAdapter` builds the authorized graph internally from source-controlled production registries.
- The caller supplies only the progress snapshot, the in-memory investigation history and the selected book scope.
- The caller cannot supply a graph, labels, claims, evidence identifiers or provider-authored prose.
- The adapter delegates display projection to the locally branded Run 360 presenter.
- The screen attaches links only after the normal answer path has revalidated progress and recorded a completed investigation.
- The screen stores no additional narrative content in the investigation ledger.

## Display and interaction

A message may include a separate “Conexiones entre investigaciones” section. It displays only the presenter's approved labels, deterministic explanation and book/chapter references. A follow-up question is prepared in the input; it is never sent automatically.

The UI checks the message's progress revision and fingerprint again before preparing the question. Stale messages are already removed by the existing conversation-history policy.

## Spoiler and provider boundary

The production graph and alias disclosures remain source-controlled and locally validated. No provider can submit graph-shaped data to this adapter. Locked, ambiguous, stale or out-of-scope information produces no visible connection.

## Production readiness

The production editorial, approved-claim, relation and alias registries are currently empty. Therefore the adapter returns a valid empty presentation rather than inventing connections. Synthetic tests exercise the boundary only; they are not Cosmere facts. The private EPUBs have not been inspected in this run, and no EPUB/XHTML text is copied or uploaded.

## Validation

The dedicated workflow runs the adapter and presenter tests, graph and investigation-session regressions, and strict TypeScript checks including `HoidScreen.tsx`.
