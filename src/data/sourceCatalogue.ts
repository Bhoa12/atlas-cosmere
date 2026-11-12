import type { WorkRecord, WorldRecord } from "./cosmereContentModel";

/** Source-backed metadata only; no protected text or inferred world membership. */
export const cosmereWorlds: WorldRecord[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

const verifiedIndexSource = "cosmere-epub-verified-index";
const declaredRosharSource = "roshar-private-declared";

const verifiedTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
];

export const sourceCatalogue: WorkRecord[] = [
  ...verifiedTitles.map((title, index) => ({
    id: "catalogue-work-" + (index + 1),
    title,
    sourceId: verifiedIndexSource,
  })),
  { id: "danzante-del-filo", title: "Danzante del Filo", sourceId: declaredRosharSource },
  { id: "esquirla-del-amanecer", title: "Esquirla del amanecer", sourceId: declaredRosharSource },
];
