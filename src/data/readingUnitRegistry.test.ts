import { buildWorkReadingUnits, validateReadingUnits } from "./readingUnitRegistry";

const units = buildWorkReadingUnits(["el-imperio-final", "elantris"]);

const valid = validateReadingUnits(units);
if (!valid.valid) throw new Error("Expected generated units to validate");

const duplicate = validateReadingUnits([
  { id: "unit-a-work", workId: "a", kind: "work", position: 1 },
  { id: "unit-a-work", workId: "a", kind: "work", position: 2 },
]);
if (duplicate.valid || duplicate.reason !== "duplicate_unit_id") {
  throw new Error("Expected duplicate IDs to fail closed");
}

let rejected = false;
try { buildWorkReadingUnits(["A"]); } catch { rejected = true; }
if (!rejected) throw new Error("Expected non-canonical work ID to be rejected");
