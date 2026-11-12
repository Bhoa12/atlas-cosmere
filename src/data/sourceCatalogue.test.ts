import { SOURCE_CATALOGUE, validateSourceCatalogue } from "./sourceCatalogue";

const result = validateSourceCatalogue(SOURCE_CATALOGUE);
if (!result.valid) throw new Error(result.errors.join("; "));

const duplicate = validateSourceCatalogue([
  { id: "obra", title: "Obra", sourcePackage: "cosmere-epub" },
  { id: "obra", title: "Otra", sourcePackage: "cosmere-epub" },
]);
if (duplicate.valid || !duplicate.errors.some((error) => error.includes("duplicate id"))) {
  throw new Error("duplicate work ids must fail closed");
}

const malformed = validateSourceCatalogue([
  { id: "Obra 1", title: "", sourcePackage: "cosmere-epub" },
]);
if (malformed.valid) throw new Error("malformed metadata must fail closed");
