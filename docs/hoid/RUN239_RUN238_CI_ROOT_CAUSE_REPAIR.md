# Run 239 — Run 238 CI root-cause repair

## Scope

Run 239 is a corrective continuation of the isolated Run 238 navigation-boundary work. It does not change the PR #131 branch, its base branch, main, prior pull requests, reader routing, progress state, or editorial production registries.

## Verified Run 238 failure

The PR #131 HEAD was `9bb38f7ac13c2b35e92812b9f51c6c47b5b5bff9`.

The workflow-run inventory returned 22 pull-request runs for that commit: 7 succeeded and 15 failed. The failures shared one source-level defect in `src/hoid/editionBoundRecommendationNavigation.ts`:

`REQUIRED_CURSOR_TARGET_KEYS` is a `Set<string>`, but the validator called `.some()` on it. `.some()` is an Array method, not a Set method.

This produced both:
- Runtime `TypeError: REQUIRED_CURSOR_TARGET_KEYS.some is not a function`, causing 12 of the 17 navigation-boundary tests to fail (67 of 79 tests across the six selected suites passed before the fix).
- Strict TypeScript errors `TS2339` and `TS7006`, which propagated to 14 other workflows that type-check the shared navigation module or its application dependencies.

The repeated workflow failures were therefore not independent regressions. They shared this one defect.

## Correction

The required-key completeness check now iterates over `Array.from(REQUIRED_CURSOR_TARGET_KEYS)` before calling `.some()`. The Set remains the canonical membership allowlist for other checks.

A new regression test removes required own data properties from otherwise valid targets and asserts that the handoff rejects them as `invalid-target`. Existing checks for unexpected keys, accessors, locator substitution, progress freshness, active-work selection, edition identity, and non-mutation remain unchanged.

## Safety and scope

- No spoiler threshold, cursor policy, edition binding, manifest rule, or evidence authorization was weakened.
- No navigation side effect or progress write was introduced.
- No provider adapter or network fallback was added.
- No EPUB/XHTML bytes, chapter prose, private URI, or source file was committed.
- No new chapter digest or narrative summary was added in this corrective run.
- The 24-work bibliography and pending-review/production separation remain unchanged.

## Validation

The Run 238 failure is reproduced from the recorded GitHub Actions logs. The fix is committed to the new branch `feat/hoid-ia-core-run239`, created from the exact Run 238 HEAD. The dedicated workflow and all dependent pull-request workflows must complete on the Run 239 HEAD before the correction is reported as validated.

## Isolation

- Base: `feat/hoid-ia-core-run238`
- Head: `feat/hoid-ia-core-run239`
- Parent: `9bb38f7ac13c2b35e92812b9f51c6c47b5b5bff9`
- PR #131 and all earlier PRs remain untouched and unmerged.
- `main` remains unchanged.

## Follow-up found on the Run 239 HEAD

The first Run 239 execution confirmed that the navigation Vitest suite now passes, including the new required-key regression test. Its strict type-check then exposed a separate workflow configuration defect: the command explicitly compiled `HoidScreen.tsx` but omitted a JSX mode, producing `TS17004: Cannot use JSX unless the '--jsx' flag is provided`.

The workflow now passes `--jsx react-native` to the direct TypeScript invocation. This is a CI command correction only; it does not change application code or the project compiler policy. The workflow must be rerun on the updated HEAD before this second correction is considered validated.
