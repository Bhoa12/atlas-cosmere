import { abstain } from "./abstention";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const result = abstain("no-authorized-evidence");
expect(result.kind === "abstain", "Debe devolver una abstención estructurada");
expect(result.reason === "no-authorized-evidence", "Debe conservar el motivo");
expect(result.message.length > 0, "Debe explicar la abstención");

const providerFailure = abstain("provider-failure");
expect(providerFailure.reason === "provider-failure", "Los fallos del proveedor no deben convertirse en respuestas");
