# Run 242 — scope-bound answer presentation

## Finding from Run 241

The final PR workflow for the explicit book-scope integration exposed one failed assertion in `answerScopeSelection.test.ts`. The test read only the `status` field but compared it with the complete result object. The implementation correctly returned the closed `incomplete` result; the assertion shape was wrong. Run 242 corrects the test to assert both the status and reason.

## Final presentation boundary

Run 241 already filters evidence before provider selection and reconstructs the answer from local reviewed claims. Run 242 adds a second, UI-facing consistency check after the cryptographically trusted presenter has validated the answer:

- every displayed citation must have a known bibliography ID and the exact catalogue title;
- every citation must carry a positive chapter and a bounded opaque locator identifier;
- citation evidence IDs must exactly match the presentation evidence-ID set;
- a single-work answer must cite only the selected work;
- a cross-work answer must cite every selected work and no additional work;
- malformed records, accessors, duplicate evidence IDs, sparse arrays and unknown scopes fail closed.

This check is not an evidence grant and does not replace the trusted presenter's per-book chapter-unlock verification.

## Cross-work chapter matrix

For explicit cross-work answers, Hoid additionally builds the existing metadata-only cross-book evidence summary from the same answer and request progress snapshot. The comparison is displayed only when segment-level provenance validates and the resulting work set exactly matches the selected scope.

The matrix displays only work titles and cited chapter numbers. It does not expose locators, source text, private paths or any new narrative material. If one selected work is absent, the mapping is incomplete, or segment provenance cannot be validated, the comparison text is withheld rather than shown partially.

In automatic mode, any answer citing multiple works also requires a valid segment-level matrix; if that provenance is incomplete, the multi-work answer is withheld rather than displayed partially. Single-work answers continue to show their ordinary per-segment citations.

## User-visible behavior

- A validated single-work response remains restricted to the selected book.
- A validated cross-work response shows an evidence matrix grouped by work and chapter.
- A mismatch produces a neutral, progress-scoped abstention with no citations or conversation context.
- Changing scope still clears prior conversational context and visible assistant history.
- No progress mutation, chapter navigation, provider fallback or production activation is introduced.

## Validation

The dedicated `hoid-answer-scope-presentation.yml` workflow runs scope contracts, the screen selection reducer, gateway/runtime tests, cursor facade tests, cross-book evidence tests and strict TypeScript checking including `HoidScreen.tsx`.

Keep the stacked PR in draft until all checks on its final head complete successfully.

## Privacy

No EPUB, XHTML, extracted passage, private path, locator value, source text, new summary or editorial claim is committed. The bibliography remains metadata-only and the production narrative registry remains unchanged.
