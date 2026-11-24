# Run 282 — exact-unit progress cursor and contiguous-prefix boundary

## Objective

Prepare a progress representation that can identify a numbered chapter unit even when its visible chapter label is duplicated, without allowing a cursor to jump over unverified units or widening the current narrative authorization boundary.

The new contract is deliberately parallel to the durable cursor ledger. It is not yet accepted by `cursorProgressLedger`, `cursorEvidenceRuntime` or the UI. Integration requires a separately reviewed ledger migration and end-to-end authorization tests.

## Contract

`src/hoid/unitProgressCursor.ts` introduces:

- `HoidUnitProgressCursor`: a closed, immutable envelope around an edition-bound `HoidChapterReference`.
- `createHoidUnitProgressCursor()`: resolves a chapter label, requiring an exact unit ID when the label is duplicated.
- `validateHoidUnitProgressCursor()`: revalidates the reference against the current edition manifest and checks that every preceding ordinal exists.
- `HoidUnitProgressBoundary`: records the current unit and the number of preceding units in the verified prefix.
- `legacyReadingPosition`: an optional compatibility projection, emitted only when the completed prefix is a one-to-one numeric chapter sequence.

The cursor contains no EPUB locator, navigation hash, XHTML, chapter title or source text. Its identity fingerprint is a consistency check, not authentication.

## Contiguous-prefix rule

A cursor at ordinal N is accepted only when the current manifest contains every ordinal from 1 through N and the selected unit matches the exact unit ID, ordinal and chapter number.

This prevents progress from jumping across missing structural entries. The manifest is never completed by inference.

For the inspected `sawt` / *Viento y verdad* edition:

- Ordinals 1–11 form the existing verified numeric prefix.
- The first occurrence of chapter 12 is present at ordinal 12 with an exact locator.
- The next inspected units occur at ordinals 14, 15 and 35; ordinal 13 and intervening units are not represented in the current manifest.

Therefore:

- The first occurrence of chapter 12 can be represented as an exact current-unit cursor candidate at ordinal 12.
- Its completed prefix remains ordinals 1–11.
- The compatibility projection is limited to chapter 11, so the open chapter 12 cannot unlock its own evidence.
- The second occurrence of chapter 12 (ordinal 14), both chapter 14 occurrences (ordinals 15 and 35), and any later unit are rejected because the preceding ordinal prefix is incomplete.
- A request for chapter 12 by number alone remains ambiguous and is rejected.

This does not change the existing numeric cursor v1 policy or durable progress ledger. The new contract is not wired into production progress or evidence retrieval.

## Legacy projection safety

A numeric `ReadingPosition` cannot represent repeated chapter labels. The adapter therefore returns a numeric position only when every completed unit has:

- ordinal equal to its one-based prefix index;
- chapter number equal to that same index; and
- no chapter number declared ambiguous by the edition manifest.

If a completed prefix includes a duplicated label, `legacyReadingPosition` is `null`. Future unit-aware evidence authorization must use ordinal-aware unlock metadata; it must not guess a numeric equivalent.

## Tests

The dedicated suite covers:

- exact resolution of the first duplicated chapter occurrence;
- refusal to resolve a duplicated label without a unit ID;
- rejection of later locators beyond a missing ordinal;
- safe chapter-11 compatibility projection while chapter 12 is open;
- ordinary unique-chapter projection;
- no completed progress at the first open unit;
- absence of locators and navigation hashes from the cursor;
- stale fingerprint rejection;
- closed object shape and accessor-safe validation.

Fixtures contain metadata only. No private EPUB, XHTML, protected passage or narrative summary is added.

## Security boundary

The cursor identifies a position; it does not assert that the current unit has been completed. It is not a reading grant, an editorial approval, a claim attestation or an evidence unlock.

The current ledger and evidence runtime remain authoritative until a future migration explicitly integrates this contract and proves that ordinal-based unlock thresholds cannot be collapsed into unsafe chapter-number thresholds.
