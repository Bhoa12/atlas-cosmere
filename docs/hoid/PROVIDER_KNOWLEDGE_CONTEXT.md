# Provider-facing knowledge context

Hoid treats provider input as a separate trust boundary.

For each request, the service:

1. freezes canonical reading progress at entry;
2. checks the question against locked catalog entities;
3. builds knowledge context only from catalog entries that are unlocked, have an original summary, and have `verified` provenance;
4. creates a second immutable provider snapshot containing only the question, canonical progress, and that authorized context;
5. validates and spoiler-checks provider output against the original request snapshot.

The provider contract is intentionally metadata-only. Context facts contain an identifier, kind, unlocking book/chapter, and an original editorial summary. EPUB passages or other protected source text must not be placed in this structure.

An empty authorized context is valid. It means the provider has no verified editorial facts to rely on; it does not authorize the provider to invent missing narrative details.

## Required regression coverage

When a test harness is added, cover at least:

- only `verified` entries with non-empty summaries reach a provider;
- `limited`, `unavailable`, and missing provenance never reach a provider;
- locked entries remain absent even if the provider request is delayed;
- mutating the original UI progress or context after service entry cannot change provider input;
- provider output is still checked against the entry progress snapshot.
