# Run 164 — React Native progress composition type-check

## Scope

This follow-up is based on the exact Run 163 head
`adc1f676de7f79fc3dca3c710b4dc3cad05098ef`. It changes the progress-freshness
workflow and adds this validation note. It does not change runtime behavior,
reading progress, evidence, recommendations or spoiler policy.

## Finding

Run 163's progress-freshness workflow completed all 82 Vitest tests and the
strict Hoid-boundary type-check successfully. Its final React Native composition
type-check failed before it could validate the screen/context integration.

The command compiled `CosmereContext.tsx` and `HoidScreen.tsx` with React's
default import syntax but omitted TypeScript's `esModuleInterop` option.
Because this repository has no root `tsconfig.json`, the command-line compiler
does not inherit the project's intended interop behavior. TypeScript reported
TS1259 for the React default imports. The unresolved React type import then
also produced a cascading implicit-any diagnostic for the provider's
`children` binding.

## Change

The React Native composition check now passes `--esModuleInterop` explicitly.
This aligns the standalone strict type-check with the existing React import
style and allows React's component/children types to resolve correctly.

No application imports were rewritten and no type errors were suppressed.
Strict mode remains enabled; `skipLibCheck` is unchanged.

## Required validation

Run the workflow on the new HEAD and require all of the following:

- 82 progress-freshness Vitest tests pass;
- strict Hoid progress/conversation boundary type-check passes;
- strict React Native context/screen composition type-check passes;
- dependent spoiler-safe conversation, typed entity, cross-book recommendation,
  reading-manifest and source-coverage workflows pass.

Do not infer success from Run 163's other successful workflows. The new HEAD
must be validated independently.

## Safety and isolation

- Base: exact Run 163 HEAD `adc1f676de7f79fc3dca3c710b4dc3cad05098ef`.
- No production behavior or reading state is changed.
- No EPUB, XHTML, chapter text, private URI or narrative claim is added.
- No production knowledge or activation receipt is written.
- Run 163 and all earlier branches remain untouched.
- Keep the follow-up PR in draft and do not merge automatically.
