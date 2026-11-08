# Content scope integrity

`resolveContentScopeIntegrity` keeps technical content identifiers consistent across three independent layers:

**declared content scope → content evidence → spoiler requests**

## Contract

The resolver requires a non-empty, unique declared scope. Evidence records must reference a declared content identifier and use the same explicit `workId` as that scope entry. Spoiler requests must also reference declared identifiers. Duplicate identifiers fail closed.

## Boundary

This module validates identifiers and declared relationships only. It does not infer a world, work, reading requirement or narrative fact from a title or identifier. It does not inspect source passages, create evidence or authorize disclosure.

Use it before composing multi-layer content workflows so a record cannot silently move between works through mismatched technical identifiers.
