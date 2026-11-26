# Run 333 — preference editor async lifecycle safety

## Objective

Harden the local reader-preference editor against asynchronous UI races without
changing the preference schema, ranking policy, progress ledger or spoiler
authorization.

## Change

- Add a provider-neutral operation fence with opaque, per-instance tokens.
- Bind asynchronous reads and writes to a screen/store generation.
- Invalidate pending UI callbacks when the store changes or the component
  unmounts.
- Permit only one preference write at a time, even before React has committed
  the next disabled render.
- Allow an obsolete write to finish its explicit local SQLite transaction,
  but prevent its result from updating a newer screen generation.
- Always release the write slot in a finally path.
- Keep the persistence adapter as the authority for compare-and-swap conflicts.

## Security and data boundaries

The operation fence is a UI lifecycle mechanism, not a trust anchor. It does
not authorize recommendations, validate evidence, alter reading progress or
change spoiler rules.

The editor continues to store only metadata preference fields. It does not
store chapter references, EPUB locators, narrative text, evidence, signatures,
conversation content or provider payloads.

Preferences still reorder and limit only the already-authorized signed display
projection. They cannot add works, unlock chapters or create cross-work routes.

## Validation

The dedicated suite covers generation invalidation, opaque tokens, foreign
tokens, single-writer behavior, stale completion, lock release and independent
screen instances. Strict TypeScript checks include the lifecycle module and
the React Native editor.

## Limitations

- An SQLite write already accepted by the native adapter is not cancelled when
  the screen unmounts; it may finish durably. Only stale UI callbacks are
  discarded.
- The repository workflow uses synthetic operation-fence tests. Physical
  Android/iOS navigation and app-background tests remain separate device QA.
