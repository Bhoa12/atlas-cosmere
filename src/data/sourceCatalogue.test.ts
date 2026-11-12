import { validateSourceCatalogue, verifiedSourceCatalogue } from "./sourceCatalogue";

const result = validateSourceCatalogue(verifiedSourceCatalogue);
if (!result.ok) throw new Error(`Expected verified catalogue to validate: ${result.reason}`);

const duplicate = {
  works: [
    { id: "work-example", title: "Example", sourceId: "cosmere-epub" as const },
    { id: "work-example", title: "Other", sourceId: "cosmere-epub" as const },
  ],
};
const duplicateResult = validateSourceCatalogue(duplicate);
if (duplicateResult.ok || duplicateResult.reason !== "duplicate-work-id")
  throw new Error("Expected duplicate work IDs to fail closed");
