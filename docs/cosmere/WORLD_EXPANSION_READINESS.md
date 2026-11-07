# World Expansion Readiness

`resolveWorldExpansionReadiness` provides one conservative integration point for a world expansion.

## States

- **blocked**: catalog or world associations are incomplete or invalid.
- **cataloged**: declared works have valid bibliographic records, but structural reading coverage is not fully verified.
- **structure-ready**: every declared work passes the existing structural coverage contract.

This status is intentionally **not a narrative status**. It does not assert that an EPUB was read, that all chapters are known, or that summaries and facts may be exposed. Spoiler gates and editorial evidence remain separate.

## Fail-closed rule

Any missing source record, invalid association, or inconsistent reading progress prevents `structure-ready`. Callers must treat unknown or invalid data as blocked rather than guessing.
