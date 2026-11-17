import type { HoidKnowledgeKind } from "./catalog";
import { canonicalEvidenceScope } from "./evidenceScope";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";

export type HoidEditorialDraft = Readonly<{
  schemaVersion: 1;
  id: string;
  kind: HoidKnowledgeKind;
  aliases: readonly string[];
  firstSafeAppearance: Readonly<{ bookId: string; chapter: number }>;
  evidenceSource: Readonly<{ bookId: string; chapter: number; locatorId: string }>;
  evidenceUnlock: Readonly<{ bookId: string; chapter: number }>;
  sourceIntegrity: Readonly<{
    editionId: string;
    navigationSha256: string;
    documentSha256: string;
  }>;
  summaryIntegrity: Readonly<{ sha256: string }>;
  summary: string;
  summaryKind: "original-editorial-summary";
  review: Readonly<{ status: "pending-review" }>;
}>;

export type HoidEditorialDraftValidation =
  | Readonly<{ status: "valid"; draft: HoidEditorialDraft }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-id"
        | "invalid-kind"
        | "invalid-aliases"
        | "invalid-appearance"
        | "invalid-evidence"
        | "invalid-source-integrity"
        | "invalid-summary"
        | "invalid-summary-integrity"
        | "invalid-review";
    }>;

const DRAFT_KEYS = new Set([
  "schemaVersion",
  "id",
  "kind",
  "aliases",
  "firstSafeAppearance",
  "evidenceSource",
  "evidenceUnlock",
  "sourceIntegrity",
  "summaryIntegrity",
  "summary",
  "summaryKind",
  "review",
]);
const KINDS = new Set<HoidKnowledgeKind>([
  "character",
  "place",
  "event",
  "concept",
  "magic",
  "organization",
  "object",
]);
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_ALIASES = 64;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  exact: boolean,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (exact && keys.length !== allowedKeys.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    if (exact) {
      for (const key of allowedKeys) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
      }
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalStringArray(value: unknown): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ALIASES) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string"
      ) return null;
      const alias = descriptor.value.trim();
      const canonical = alias.normalize("NFKC").toLowerCase();
      if (!alias || alias.length > 256 || seen.has(canonical)) return null;
      seen.add(canonical);
      result.push(alias);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validPositiveChapter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Validate an original editorial draft against the current edition manifest.
 *
 * Drafts are deliberately not accepted by the production evidence runtime.
 * They are staging artifacts until an independent editorial review promotes
 * them into the approved registry. This module stores no source passage.
 */
export function validateHoidEditorialDraft(value: unknown): HoidEditorialDraftValidation {
  const raw = canonicalRecord(value, DRAFT_KEYS, true);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  if (
    raw.schemaVersion !== 1 ||
    typeof raw.id !== "string" ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(raw.id) ||
    raw.id.length > 128
  ) return Object.freeze({ status: "invalid", reason: "invalid-id" });

  if (typeof raw.kind !== "string" || !KINDS.has(raw.kind as HoidKnowledgeKind)) {
    return Object.freeze({ status: "invalid", reason: "invalid-kind" });
  }

  const aliases = canonicalStringArray(raw.aliases);
  if (!aliases) return Object.freeze({ status: "invalid", reason: "invalid-aliases" });

  const appearance = canonicalRecord(
    raw.firstSafeAppearance,
    new Set(["bookId", "chapter"]),
    true,
  );
  if (
    !appearance ||
    typeof appearance.bookId !== "string" ||
    !appearance.bookId.trim() ||
    !validPositiveChapter(appearance.chapter)
  ) return Object.freeze({ status: "invalid", reason: "invalid-appearance" });

  const appearanceManifest = getHoidReadingManifest(appearance.bookId);
  const appearanceUnit = appearanceManifest.status === "ready"
    ? appearanceManifest.manifest.units.find(unit => unit.chapterNumber === appearance.chapter)
    : undefined;
  if (!appearanceUnit || !appearanceUnit.locatorId) {
    return Object.freeze({ status: "invalid", reason: "invalid-appearance" });
  }

  const source = canonicalRecord(
    raw.evidenceSource,
    new Set(["bookId", "chapter", "locatorId"]),
    true,
  );
  const unlock = canonicalRecord(
    raw.evidenceUnlock,
    new Set(["bookId", "chapter"]),
    true,
  );
  if (!source || !unlock) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  const scope = canonicalEvidenceScope(source, unlock);
  if (!scope) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  // Draft schema v1 deliberately keeps first appearance, source and unlock
  // within one work. Cross-work chronology needs a separately reviewed schema.
  if (
    appearance.bookId !== scope.sourceBookId ||
    appearance.chapter > scope.unlockChapter
  ) return Object.freeze({ status: "invalid", reason: "invalid-appearance" });

  const integrity = canonicalRecord(
    raw.sourceIntegrity,
    new Set(["editionId", "navigationSha256", "documentSha256"]),
    true,
  );
  const sourceManifest = getHoidReadingManifest(scope.sourceBookId);
  const verifiedDocumentSha256 = sourceManifest.status === "ready"
    ? getVerifiedChapterDocumentSha256(
        scope.sourceBookId,
        sourceManifest.manifest.editionId,
        sourceManifest.manifest.navigationSha256,
        scope.sourceChapter,
      )
    : null;
  if (
    !integrity ||
    sourceManifest.status !== "ready" ||
    integrity.editionId !== sourceManifest.manifest.editionId ||
    integrity.navigationSha256 !== sourceManifest.manifest.navigationSha256 ||
    typeof integrity.documentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(integrity.documentSha256) ||
    !verifiedDocumentSha256 ||
    integrity.documentSha256 !== verifiedDocumentSha256
  ) return Object.freeze({ status: "invalid", reason: "invalid-source-integrity" });

  if (
    typeof raw.summary !== "string" ||
    raw.summary.trim().length < 80 ||
    raw.summary.trim().length > MAX_SUMMARY_LENGTH ||
    raw.summaryKind !== "original-editorial-summary"
  ) return Object.freeze({ status: "invalid", reason: "invalid-summary" });

  const summaryIntegrity = canonicalRecord(raw.summaryIntegrity, new Set(["sha256"]), true);
  const summarySha256 = typeof summaryIntegrity?.sha256 === "string"
    ? summaryIntegrity.sha256
    : "";
  if (
    !summaryIntegrity ||
    !/^[a-f0-9]{64}$/.test(summarySha256) ||
    summarySha256 !== sha256Hex(raw.summary.trim())
  ) return Object.freeze({ status: "invalid", reason: "invalid-summary-integrity" });

  const review = canonicalRecord(raw.review, new Set(["status"]), true);
  if (!review || review.status !== "pending-review") {
    return Object.freeze({ status: "invalid", reason: "invalid-review" });
  }

  const draft: HoidEditorialDraft = Object.freeze({
    schemaVersion: 1,
    id: raw.id,
    kind: raw.kind as HoidKnowledgeKind,
    aliases,
    firstSafeAppearance: Object.freeze({
      bookId: appearance.bookId,
      chapter: appearance.chapter,
    }),
    evidenceSource: Object.freeze({
      bookId: scope.sourceBookId,
      chapter: scope.sourceChapter,
      locatorId: scope.locatorId,
    }),
    evidenceUnlock: Object.freeze({
      bookId: scope.unlockBookId,
      chapter: scope.unlockChapter,
    }),
    sourceIntegrity: Object.freeze({
      editionId: integrity.editionId as string,
      navigationSha256: integrity.navigationSha256 as string,
      documentSha256: integrity.documentSha256,
    }),
    summaryIntegrity: Object.freeze({ sha256: summarySha256 }),
    summary: raw.summary.trim(),
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  });

  return Object.freeze({ status: "valid", draft });
}

export function validateHoidEditorialDraftBatch(
  values: unknown,
): Readonly<{ status: "valid"; drafts: readonly HoidEditorialDraft[] }> |
  Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }> {
  try {
    if (!Array.isArray(values)) {
      return Object.freeze({ status: "invalid", reason: "invalid-batch" });
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(values, "length");
    if (
      !lengthDescriptor ||
      !Object.prototype.hasOwnProperty.call(lengthDescriptor, "value") ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > 512
    ) return Object.freeze({ status: "invalid", reason: "invalid-batch" });

    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(values);
    if (keys.length !== length + 1 || !keys.includes("length")) {
      return Object.freeze({ status: "invalid", reason: "invalid-batch" });
    }

    const drafts: HoidEditorialDraft[] = [];
    const ids = new Set<string>();
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return Object.freeze({ status: "invalid", reason: "invalid-batch" });

      const validation = validateHoidEditorialDraft(descriptor.value);
      if (validation.status !== "valid") {
        return Object.freeze({ status: "invalid", reason: "invalid-draft" });
      }
      if (ids.has(validation.draft.id)) {
        return Object.freeze({ status: "invalid", reason: "duplicate-id" });
      }
      ids.add(validation.draft.id);
      drafts.push(validation.draft);
    }

    return Object.freeze({ status: "valid", drafts: Object.freeze(drafts) });
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-batch" });
  }
}

/**
 * Source-backed original summaries from the accessible Roshar and Cosmere
 * EPUBs. Every draft is pending review and is intentionally excluded from the
 * production editorial registry.
 */
const RAW_DRAFTS: readonly unknown[] = Object.freeze([
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-001.cenn-battle",
    kind: "event",
    aliases: Object.freeze(["batalla inicial de Cenn"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 1 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 1,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-012.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 2 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70",
    }),
    summaryIntegrity: Object.freeze({ sha256: "f6ff4d0c396ad06b3e4869585ddec96b16fbfe29cc0bc0692a3958581f1ec64f" }),
    summary: "El capítulo sigue a Cenn, un recluta de quince años que afronta una escaramuza con poca experiencia. Dallet lo orienta y lo integra en el pelotón de Kaladin, cuya disciplina y coordinación contrastan con el desorden de otras unidades. La formación protege a Cenn durante buena parte del combate, pero el caos termina separándolo del grupo y dejándolo herido; Kaladin interviene para salvarlo y organiza la atención a los heridos. La escena presenta el liderazgo táctico de Kaladin y su preocupación por los soldados jóvenes desde la perspectiva vulnerable de un recién llegado.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-001.lift-departure",
    kind: "event",
    aliases: Object.freeze(["partida de Lift de Azir"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 1 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 1,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/001.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 2 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc",
    }),
    summaryIntegrity: Object.freeze({ sha256: "29b89159bdb622ccefa35d97c26e997683500eb572c6979e9e2829578d6fd8b2" }),
    summary: "El capítulo presenta a Lift mientras se aleja de Azir acompañada por Wyndle. Su carrera y el uso de sus capacidades para deslizarse reflejan su deseo de seguir moviéndose y evitar quedar atrapada por las expectativas ajenas. Al detenerse, contempla la ciudad que deja atrás y reconoce que su salida es una despedida deliberada, no un simple impulso pasajero. La escena establece el conflicto entre conservar su independencia y afrontar los cambios que intenta esquivar.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-001.akinah-expedition",
    kind: "event",
    aliases: Object.freeze(["expedición a Akinah"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 1 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 1,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/1.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 2 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae",
    }),
    summaryIntegrity: Object.freeze({ sha256: "dac6798cb130a17b714584d131204b7e4265748cdf464af8668f22f751cd7ad0" }),
    summary: "Rysn revisa informes comerciales para encontrar una nueva oportunidad de viaje mientras intenta atender a Chiri-Chiri, cuya salud ha empeorado. La relación con Nikli muestra que procura conservar su autonomía pese a necesitar ayuda en algunas tareas. La información que recibe sobre Akinah como posible hogar de Chiri-Chiri coincide con una solicitud de Navani para investigar la zona de una expedición marítima anterior. Rysn conecta ambas pistas y decide acudir a Urithiru para estudiar el encargo.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-002.kaladin-slave-caravan",
    kind: "event",
    aliases: Object.freeze(["viaje de Kaladin como esclavo"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 2 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 2,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-013.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 3 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "5f76bd1de8106ebcba964f730368426fc22df1c2a7862e4f01dcf57ec0f63877",
    }),
    summaryIntegrity: Object.freeze({ sha256: "bba8b74d05b28d3167bc0c0e82a8c66a53d2174b9a00249764158db5d7fc2abc" }),
    summary: "Kaladin viaja como esclavo en un carromato por las Montañas Irreclamadas, debilitado y marcado con el shash. Aunque el miedo y las pérdidas lo han llevado a apartarse de los demás, se resiste a adoptar la misma desconfianza que observa entre los cautivos. Una vientospren con forma de muchacha lo llama por su nombre y conversa con él, algo que contradice lo que cree saber sobre los spren. Cuando un compañero enferma, Kaladin reconoce la tos chirriante y explica que la hidratación podría salvarlo. El tratante de esclavos, sin embargo, ordena matar al enfermo para evitar riesgos para el resto del grupo. La decisión reaviva el conflicto de Kaladin entre su agotamiento y el impulso de proteger a otros. Las hojas de ruinaoscura que había recogido terminan dispersas, y su posible uso queda sin resolver.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-002.lift-yeddaw-arrival",
    kind: "event",
    aliases: Object.freeze(["llegada de Lift a Yeddaw"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 2 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 2,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/002.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 3 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "397c116112ca87b77cdd2c324156349594f47660d332a10417884119c8e7b0a0",
    }),
    summaryIntegrity: Object.freeze({ sha256: "71a11f952189f079a9acfdeaf46b35f4a973c499699dbcc8f943c63a5bb000f6" }),
    summary: "Lift llega a Yeddaw, una ciudad excavada en la roca, y conversa con Wyndle sobre su deseo de conseguir una hoja esquirlada. El spren se niega a explicar lo que sabe y advierte que el comportamiento del Llanto y la posible llegada de una nueva tormenta indican que algo grave se aproxima. Lift reconoce que Oscuridad se encuentra en la ciudad y que continúa persiguiendo a personas que considera poco importantes, aunque disfraza su propósito de viaje con su interés por unas tortitas locales. Al acercarse a la entrada, ambos observan una larga cola formada también por familias, no solo por comerciantes. Dominada por el hambre y sin llevar dinero, Lift decide avanzar por debajo de un carro para conseguir comida.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-002.rysn-navani-akinah-mission",
    kind: "event",
    aliases: Object.freeze(["acuerdo de expedición a Akinah"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 2 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 2,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/2.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 3 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "511dd868f3feb65f3cc28566bbac167762ad70dddccffcae863be31e64f144dc",
    }),
    summaryIntegrity: Object.freeze({ sha256: "9fa0072f28c0e8e98087e78c2663f664889cd4bcc4dca0eee963f081370f82bd" }),
    summary: "Rysn llega a Urithiru y se reúne con Navani para informar sobre el barco fantasma Primeros Sueños. Explica que el navío fue saboteado y que desaparecieron los cuadernos de bitácora, una moldeadora de almas y el artefacto que utilizaba. Navani expone sus sospechas sobre Akinah y la tormenta que oculta la isla, además de la posible amenaza que representa para los Radiantes. Chiri-Chiri, que parece recuperar vigor, atrae la atención de Navani al alimentarse de luz tormentosa. Rysn acepta que el Vela Errante participe en la expedición a cambio de apoyo logístico, escolta y la posibilidad de explorar tecnología que pueda mejorar su movilidad. El acuerdo se cierra con la misión aún por comenzar.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "tfe.chapter-001.vin",
    kind: "character",
    aliases: Object.freeze(["Vin"]),
    firstSafeAppearance: Object.freeze({ bookId: "tfe", chapter: 1 }),
    evidenceSource: Object.freeze({
      bookId: "tfe",
      chapter: 1,
      locatorId: "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/001.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "tfe", chapter: 2 }),
    sourceIntegrity: Object.freeze({
      editionId: "cosmere-epub-merged-v1",
      navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
      documentSha256: "cfc6a6057a477cfba6e7795d30dca2324a97a5dbdefa86b6500aa437a625844a",
    }),
    summaryIntegrity: Object.freeze({ sha256: "fe550c8880d21a183cdd690039f6ef9b828837282558c75b0924f2311fdee36a" }),
    summary: "Vin vive escondida en el refugio de una banda de ladrones de Luthadel y organiza su conducta alrededor de la desconfianza aprendida tras la traición de su hermano Reen. Camon, el jefe de la banda, prepara una estafa haciéndose pasar por un noble empobrecido que busca un contrato de transporte con el Ministerio. Vin detecta que la puesta en escena no encaja con la situación económica fingida y propone cambios que vuelven más convincente el engaño. También utiliza de forma instintiva la capacidad que llama Suerte para moderar la ira de Camon y reducir las sospechas del prelado durante la negociación. El capítulo destaca su observación, su resistencia y el modo discreto en que influye en quienes la rodean, sin explicar todavía el origen de esa capacidad.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "tfe.chapter-002.kelsier",
    kind: "character",
    aliases: Object.freeze(["Kelsier", "Kell"]),
    firstSafeAppearance: Object.freeze({ bookId: "tfe", chapter: 2 }),
    evidenceSource: Object.freeze({
      bookId: "tfe",
      chapter: 2,
      locatorId: "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/002.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "tfe", chapter: 3 }),
    sourceIntegrity: Object.freeze({
      editionId: "cosmere-epub-merged-v1",
      navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
      documentSha256: "13604dc85df709443e6cd215a3e1a9deabe8f69f118dcc9823127b82ad486fc1",
    }),
    summaryIntegrity: Object.freeze({ sha256: "2832f63706c3dcead79763a97373e9f218d437b0185553f0d9b784ad849f98f2" }),
    summary: "Kelsier regresa a Luthadel y se reúne con Dockson para reunir un equipo para un trabajo ambicioso cuyo objetivo todavía no se detalla. Conversan sobre antiguos miembros de la banda, reclutan especialistas y mencionan la participación de Yeden y de Marsh, hermano de Kelsier. En paralelo, Vin acompaña a Camon al Ministerio y descubre que pretende traicionar a Theron y quedarse con el beneficio de la operación. La entrevista con el sumo prelado Arriev termina con la concesión del contrato, después de que Vin vuelva a influir en sus emociones. Kelsier y Dockson observan la salida, reconocen indicios de alomancia en Vin y consideran que podría ser una nacida de la bruma. Cuando aparece un Inquisidor de acero, Kelsier decide distraerlo mientras Dockson se ocupa de los perseguidores. El capítulo conecta por primera vez las tramas de Kelsier y Vin sin revelar el desarrollo posterior.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-003.shallan-kharbranth",
    kind: "event",
    aliases: Object.freeze(["llegada de Shallan a Kharbranth"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 3 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 3,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-015.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 4 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "aad893dde20e24a5444100d260f4d466f6ef553a13d676457d6f42015d774a0e",
    }),
    summaryIntegrity: Object.freeze({ sha256: "2fe2105e123b4748ac8592e614e2bc20b5857279ff9876a8c76a49ba80da6ce0" }),
    summary: "Shallan llega a Kharbranth tras meses siguiendo el rastro de Jasnah Kholin. Recorre la ciudad con ayuda de Yalb y se dirige al Cónclave, donde espera convertirse en pupila de Jasnah y obtener la formación que desea. Bajo esa aspiración pública pesa una urgencia familiar: la casa Davar atraviesa graves deudas y la muerte de su padre debe permanecer oculta. El capítulo termina cuando Shallan se dispone a encontrarse con Jasnah.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-003.hauka-grain-cart",
    kind: "event",
    aliases: Object.freeze(["incidente del carro de grano"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 3 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 3,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/003.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 4 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "2a82686dd7fa7908d4b175f9b03f165309e08ccbb2294c6bcd32443b6d0d3905",
    }),
    summaryIntegrity: Object.freeze({ sha256: "f8f95da0b83d9485b47a2fd001a137f5b01c032924a8b67be6131720ca813951" }),
    summary: "En el puesto de inmigración de Tashikk, Hauka sospecha de un conductor que se hace pasar por granjero y detecta que transporta grano de procedencia dudosa. Durante la inspección descubre a una niña escondida entre la carga. La persecución se descontrola: la muchacha esquiva a los guardias, provoca que el carro pierda su carga y el grano termina dispersándose sobre el barrio de inmigrantes. Hauka queda sin una explicación clara de lo sucedido y debe afrontar las consecuencias administrativas del incidente.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-003.lopen-talik-delegation",
    kind: "event",
    aliases: Object.freeze(["encuentro de Lopen y Talik"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 3 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 3,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/3.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 4 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "709bca2ea215db4e90fc654b4b503a7c71d96bb40a508d5347ec83006b8cc286",
    }),
    summaryIntegrity: Object.freeze({ sha256: "da18ca2f77a275d8d7db1e69f14e64731adb53c13bd9c97e0eaf294c99e998ac" }),
    summary: "En Urithiru, Lopen recibe a una delegación reshi y se lleva a Talik a contemplar la ciudad desde las alturas para romper el hielo. Talik pregunta por qué las grandes naciones buscan ahora la cooperación de su pueblo; Lopen responde con franqueza sobre la amenaza de una posible invasión y la necesidad de incluir también a comunidades pequeñas. Talik acepta trasladar el consejo al rey y comparte una información delicada sobre la transformación de este y su vínculo con un spren. Después, Kaladin encomienda a Lopen preparar una nueva expedición a Akinah con otros miembros del grupo.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-004.kaladin-highstorm-camp",
    kind: "event",
    aliases: Object.freeze(["llegada al campamento Kholin"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 4 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 4,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-016.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 5 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "1a5d55dd8eaa304b14a10526e50a98826de139abbc402013150dd795f44bef89",
    }),
    summaryIntegrity: Object.freeze({ sha256: "8e0158b020211d36b279ca8bdb9c0cc338e3117f4f47b4de6a2352a5a6a3e80d" }),
    summary: "Kaladin continúa el viaje encerrado en la carreta de esclavos y mantiene con la vientospren una conversación sobre su aparente indiferencia ante el sufrimiento. Cuando Tvlakv pierde la orientación, Kaladin destruye el mapa y se niega a fingir que conoce la región. El intercambio deja al descubierto tanto la desconfianza entre ambos como el peso que todavía tiene para Kaladin el motivo de su esclavitud. Durante la alta tormenta, permanece atento a los riesgos que amenazan a los cautivos y al propio convoy. Tras el temporal, la caravana reanuda la marcha por un paisaje que recupera actividad. La spren señala una concentración de personas hacia el este; al acercarse a una elevación, Kaladin reconoce que se trata de un enorme campamento militar alezi y distingue un estandarte de la casa Kholin. El capítulo termina con su reacción ante ese destino inesperado.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-004.lift-immigrant-district",
    kind: "event",
    aliases: Object.freeze(["recorrido de Lift por el barrio de inmigrantes"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 4 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 4,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/004.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 5 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "4437c0e0ff5a617490a087d7c887117e63ff5f6f627d5e9f4515206fb77a3507",
    }),
    summaryIntegrity: Object.freeze({ sha256: "48b7f0e60d6d462a7a6c45f6c211d4ff81638da9e15f76210d2c71d1413ae313" }),
    summary: "Después de escapar de los guardias, Lift recorre el barrio de inmigrantes de Tashikk junto a Wyndle. Observa la arquitectura elevada, las viviendas improvisadas y la mezcla de comunidades que ocupan la zona, mientras intenta encontrar algo que pueda cambiar por comida. Su conversación con Wyndle vuelve a mostrar la diferencia entre las prioridades prácticas de Lift y las expectativas que él tiene sobre su vínculo. Lift intenta vender un cuaderno que ha sustraído de un puesto de guardia, pero Wyndle descubre que solo contiene un registro de turnos y visitas administrativas. Frustrada por no poder obtener comida, Lift arroja el cuaderno sin mirar y golpea accidentalmente a una transeúnte. Un guardia la acusa y ambos vuelven a huir por las callejuelas.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-004.rysn-crew-trust",
    kind: "event",
    aliases: Object.freeze(["zarpe del Vela Errante"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 4 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 4,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/4.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 5 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "a283662ad3c34e67db60ec847fd8c4166725361d166a507c95245141ecedfcdb",
    }),
    summaryIntegrity: Object.freeze({ sha256: "22acb4f51b8c3f421da85d7bd1b85e1889b8ab22f9db882cef43c9040a583bf9" }),
    summary: "Rysn embarca en el Vela Errante para iniciar la expedición como propietaria, aunque pronto comprueba que la autoridad formal no equivale a la confianza de la tripulación. La capitana Dlrwan cuestiona que deba acompañar la misión y los marineros muestran reservas ante su nombramiento. Rysn investiga el origen del resentimiento y comprende que parte de la tripulación esperaba que Vstim entregara el barco a Dlrwan, que había preparado y entrenado a sus marineros para él. También descubre que la muerte de la mascota del barco y el destino de la expedición han alimentado supersticiones e inquietudes. En vez de imponer su presencia, permite que quien no quiera participar permanezca en puerto y busca formas de integrarse sin humillar a los demás. Tras algunas bajas limitadas, la tripulación se prepara y el barco zarpa.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
]);

const VALIDATED_BATCH = validateHoidEditorialDraftBatch(RAW_DRAFTS);

/** Staging-only drafts; never passed to HoidEvidenceRuntime. */
export const HOID_EDITORIAL_DRAFTS: readonly HoidEditorialDraft[] =
  VALIDATED_BATCH.status === "valid" ? VALIDATED_BATCH.drafts : Object.freeze([]);

export function getHoidEditorialDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_BATCH.status === "invalid") return "invalid";
  return HOID_EDITORIAL_DRAFTS.length > 0 ? "pending-review" : "empty";
}
