import type { HoidKnowledgeKind } from "./catalog";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
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

  if (!isHoidKnowledgeKind(raw.kind)) {
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
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-005.shallan-jasnah-assessment",
    kind: "event",
    aliases: Object.freeze(["evaluación de Shallan ante Jasnah"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 5 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 5,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-017.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 6 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "1cc47f030de9132acec9b6eaca0310e325f4eb34d49bac7294611d09080d68d8",
    }),
    summaryIntegrity: Object.freeze({ sha256: "50994fd820c5f81246f12544412891810836c50e49c709fe0c8df51f03cfd1d5" }),
    summary: "Shallan llega por fin ante Jasnah Kholin en Kharbranth y la encuentra conversando con el rey Taravangian. Al ver el moldeador de almas que lleva Jasnah, reconoce su parecido con el objeto que su familia había encontrado. Jasnah aclara que todavía no la ha aceptado como pupila y somete su formación a una evaluación sobre música, idiomas, escritura, historia y ciencias. Las respuestas de Shallan revelan lagunas importantes y la exigente erudita cuestiona tanto su preparación como su actitud. Aunque la entrevista resulta intimidante, Shallan decide insistir: necesita permanecer cerca de Jasnah por el moldeador de almas, que pretende robar.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-005.lift-remembering-forgotten",
    kind: "event",
    aliases: Object.freeze(["reflexión de Lift sobre los olvidados"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 5 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 5,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/005.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 6 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "89da9c44aceb5254d8b29d63f9db940f0d13f6de03dc682883670fefd03dc83e",
    }),
    summaryIntegrity: Object.freeze({ sha256: "dcad662155a8d6e87c79eef48b4d7e55e591a434fae4131b6d23be7214e84111" }),
    summary: "Después de escapar de un guardia, Lift descansa sobre una lona en el barrio pobre y reflexiona sobre el juramento de recordar a quienes han sido olvidados. La conversación con Wyndle sobre las islas Reshi la lleva a pensar en su madre y en su propia procedencia. Lift explica que evita quedarse mucho tiempo en un lugar porque, cuando la gente la reconoce, empieza a esperar que se comporte según la imagen que se ha formado de ella. El capítulo profundiza en su conflicto con la identidad, la pertenencia y las expectativas ajenas. Finalmente, el hambre la devuelve a lo inmediato y decide buscar a unos pillastres callejeros.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-005.rysn-lopen-fabrial-demonstration",
    kind: "event",
    aliases: Object.freeze(["conversación de Rysn y Lopen y demostración de fabrial"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 5 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 5,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/5.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 6 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "3aefc41eadb2b580c80d738552b3d10e1f93fd7c8755cf98b824e6922a9df515",
    }),
    summaryIntegrity: Object.freeze({ sha256: "65d8e0cb15f2109e5bf2b95ef52e59be8185176eb1b5724ce0866df5dea9ea6f" }),
    summary: "Durante la travesía hacia Aimia, Rysn intenta acercarse a una tripulación que todavía desconfía de su autoridad como rebsk. Su conversación con Lopen aborda la manera en que otras personas reducen a quienes tienen una discapacidad a su condición física, en vez de tratarlos como individuos completos. El humor compartido les permite conectar sin negar esa incomodidad. Después, Rushu demuestra un fabrial basado en dos gemas emparejadas cuyos movimientos son opuestos y explica cómo el principio se aplica a otras construcciones fabriales. La demostración se interrumpe cuando la capitana informa de un moldeado de almas oscuro y de malos augurios.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),

  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-006.kaladin-bridge-four",
    kind: "event",
    aliases: Object.freeze(["primera salida de Puente Cuatro"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 6 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 6,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-019.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 7 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "9af4c12b07013a211fa399d6b53061c9207cfd49c42c56d89ded8cdc68c9c1c2",
    }),
    summaryIntegrity: Object.freeze({ sha256: "3a702f5cf75e56b4765f9ae5983765a7a19c1d8fba68c9aaf4094db37d8eeac8" }),
    summary: "Kaladin llega al campamento de Sadeas y espera que lo incorporen al ejército como lancero. Una noble inspecciona a los cautivos, pero la información que Tvlakv revela sobre la marca de Kaladin y su historial impide que lo acepte como soldado. Lo destinan a una cuadrilla de puentes. En su primera salida a las Llanuras Quebradas, el grupo debe transportar el puente bajo fuego parshendi, y Kaladin comprueba que los porteadores son tratados como sacrificables. Tras el combate, queda entre los supervivientes y recibe la orden de volver a cargar el puente, mientras la spren empieza a manifestar una identidad propia.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-006.lift-tashikk-orphanage",
    kind: "event",
    aliases: Object.freeze(["visita de Lift al orfanato Luz de Tashi"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 6 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 6,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/006.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 7 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "b911d60b2e2630d79e6659a441ce4210e228b11c47ad6f9f026a9ce6b3c48de2",
    }),
    summaryIntegrity: Object.freeze({ sha256: "970c0970240499bb55e047902cfb2889795277e3009adcaa0d2b46d1d1bb3372" }),
    summary: "Lift busca comida en Tashikk y sigue las pistas de una niña de la calle hasta el orfanato Luz de Tashi. Allí presencia la llegada de un niño con una lesión grave y la reacción severa de la encargada, conocida como la Tocón. Lift se queda con el pequeño y discute con la mujer, que limita la ayuda que le ofrece a unas pocas comidas y un lugar incómodo para dormir. Un anciano le propone un intercambio de información: le explica cómo tratar con la encargada a cambio de que Lift responda a una pregunta filosófica sobre su lugar en la comunidad. Lift responde con su humor habitual y decide marcharse a una cita.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-006.rysn-worm-grain-trade",
    kind: "event",
    aliases: Object.freeze(["intercambio del grano con gusanos"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 6 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 6,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/6.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 7 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "4025cf190a6b7d6e17d66036705f6aa1f16f3194b3964a29ea4aa77249a3bc3b",
    }),
    summaryIntegrity: Object.freeze({ sha256: "e701f34a58137d705dbe4829682b29c2f424a88017bcd41751d8110ebc9a7bd5" }),
    summary: "El hallazgo de larvas en los toneles de grano amenaza con desmoralizar a la tripulación del Vela Errante. Rysn descarta las interpretaciones supersticiosas y recurre a una lección comercial de Vstim: identifica a un grupo de compradores para quienes el grano sigue teniendo valor y negocia un intercambio que aporta provisiones y calma a la tripulación. Después, Rysn y Nikli hablan sobre confianza, traición y la posición de ambos dentro del barco. Nikli le advierte que ha oído conversaciones reservadas relacionadas con la misión. Cuando se retira, mantiene una comunicación mental con otros miembros de su pueblo, que debaten qué hacer con la expedición y le permiten intentar de nuevo disuadir a los viajeros.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),

  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-007.shallan-palanaeum-wait",
    kind: "event",
    aliases: Object.freeze(["espera de Shallan en el Palaneo"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 7 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 7,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-020.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 8 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "30d9cecf9748261ad6e47fcea6064ac2f93ec523e8fe6a2d528d76306233bebb",
    }),
    summaryIntegrity: Object.freeze({ sha256: "10c850eaefe0ded795c175f8b9e6ffeba49a02808e746b138d2105b3c327951b" }),
    summary: "Shallan espera en el Palaneo mientras prepara un nuevo intento de convencer a Jasnah para que la acepte como pupila. Al recorrer la biblioteca descubre el coste de acceso a sus fondos y decide aguardar en una sala de lectura. Para ordenar sus ideas, dibuja Kharbranth y a las personas que ha conocido; después reproduce de memoria una demostración de Jasnah con el moldeador de almas y redacta una carta que presenta su insistencia como una petición razonada. Su objetivo no es sencillo: busca aprender de Jasnah, pero también persigue un propósito privado relacionado con el fabrial. Durante la espera conoce al hermano Kabsal, un fervoroso de trato informal que se interesa por sus dibujos y le pide que anuncie su visita a Jasnah. El capítulo termina cuando Jasnah llega a la sala.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-007.lift-tracks-darkness",
    kind: "event",
    aliases: Object.freeze(["seguimiento de Oscuridad en Yeddaw"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 7 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 7,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/007.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 8 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "c98233f98e7b5368a1e9e1d6db216ebbc4c22b43aa056624758a76ff67d7540f",
    }),
    summaryIntegrity: Object.freeze({ sha256: "006c275d6a9539b5ebdff94228ef5cc10576ed13b88751967d574aa4ee36fc24" }),
    summary: "Lift sigue a la capitana de la guardia hasta su vivienda y pasa la noche vigilando desde las terrazas cultivadas en la roca. Cuando Wyndle la despierta, descubre que Oscuridad ha acudido a interrogar a la capitana sobre una joven con poderes inusuales. Lift escucha cómo él contrasta los detalles del incidente en la entrada y ordena que continúe la búsqueda. Al reconocer que el informe ha atraído a su perseguidor, Lift comprende que su maniobra ha funcionado, pero también que está cerca de alguien peligroso. Decide seguirlo para averiguar a quién busca y qué pretende.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-007.lopen-crew-unease",
    kind: "event",
    aliases: Object.freeze(["inquietud de Lopen durante la travesía"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 7 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 7,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/7.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 8 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "c2d2eb939495f883a1d507a42728ca3f39b561534e6984de56af574872066aaf",
    }),
    summaryIntegrity: Object.freeze({ sha256: "fc38f6238ac4f8bd52f544543f63afa5d5e0cff5a6e02ce0f6b0f0c0e4033854" }),
    summary: "Lopen conversa con Cuerda sobre la tripulación y sobre las señales extrañas que ella observa entre los spren. Cuerda explica que ha empezado a sentirse atraída por lo desconocido y comenta un aumento de suertespren, mientras Lopen decide comunicar el hallazgo a Rushu. Después, Lopen y Huio hablan de la guerra y de la inquietud que les produce la aparente falta de avances. Huio experimenta con aluminio y una vinculacaña, observa una reacción de los spren y daña accidentalmente el mecanismo. Cuando Lopen vuelve a cubierta, encuentra a los marineros reunidos alrededor de algo grande y sin vida que flota junto al barco.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),

  Object.freeze({
    schemaVersion: 1,
    id: "tfe.chapter-003.vin-kelsier",
    kind: "event",
    aliases: Object.freeze(["encuentro de Vin con Kelsier"]),
    firstSafeAppearance: Object.freeze({ bookId: "tfe", chapter: 3 }),
    evidenceSource: Object.freeze({ bookId: "tfe", chapter: 3, locatorId: "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/003.xhtml" }),
    evidenceUnlock: Object.freeze({ bookId: "tfe", chapter: 4 }),
    sourceIntegrity: Object.freeze({ editionId: "cosmere-epub-merged-v1", navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee", documentSha256: "bdbdd338d35c37d455c542384b51c4d67e7e46c1e4d2a5bf6d1535e02c4808c7" }),
    summaryIntegrity: Object.freeze({ sha256: "99b6fd64ff0ed0397a19913b1eb69067584586ad291d92bef9db55ca66776ddb" }),
    summary: "Tras advertir que el Ministerio puede actuar contra la banda, Vin decide marcharse y pide a Ulef que la acompañe. La petición llega a oídos de Camon, que interpreta la huida como una traición y la golpea cuando intenta escapar. Un noble desconocido irrumpe en la guarida y, junto a Dockson, neutraliza la amenaza y explica que la banda estaba a punto de ser descubierta por el Ministerio. El recién llegado se presenta como Kelsier y reconoce que la capacidad que Vin llama Suerte es alomancia. Más tarde, la somete a una prueba con metales: Vin demuestra que puede afectar las emociones en más de una forma y descubre que su potencial supera al de una brumosa corriente. Kelsier le explica que esa combinación la convierte en una nacida de la bruma y le propone comprender el alcance de sus habilidades.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-008.lift-follows-darkness",
    kind: "event",
    aliases: Object.freeze(["seguimiento de Oscuridad en la ciudad"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 8 }),
    evidenceSource: Object.freeze({ bookId: "edgedancer", chapter: 8, locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/008.xhtml" }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 9 }),
    sourceIntegrity: Object.freeze({ editionId: "edgedancer-epub-v1", navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517", documentSha256: "3b6e7ed84bcd4b08908f0f022edfc127b2dca223d834dc8841359fcb3ecbe095" }),
    summaryIntegrity: Object.freeze({ sha256: "860d99d35585b70113785cd3bdfefa44061029cf936bbf67f391133dc7afe399" }),
    summary: "Lift sigue a Oscuridad por la ciudad y presencia cómo detiene a una joven ladrona en el mercado. Cuando la chica, aterrorizada, intenta defenderse con una navaja, Oscuridad la mata y después formaliza el incidente como una ejecución conforme a la ley. Lift intenta devolverle la vida con su maravilla, pero Wyndle le explica que la herida de una hoja esquirlada y el tiempo transcurrido impiden salvarla. Indignada, Lift continúa siguiendo a Oscuridad hasta su alojamiento; usa su poder para ocultarse, entra por una ventana y termina encontrando y comiéndose su desayuno. Wyndle teme que se estén acercando demasiado a alguien peligroso, pero Lift decide que aún deben averiguar qué está haciendo.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-008.rysn-dead-santhid",
    kind: "event",
    aliases: Object.freeze(["hallazgo del santhid muerto"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 8 }),
    evidenceSource: Object.freeze({ bookId: "dawnshard", chapter: 8, locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/8.xhtml" }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 9 }),
    sourceIntegrity: Object.freeze({ editionId: "dawnshard-epub-v1", navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075", documentSha256: "04cf11bf2784a7cc8b01cc226cb403744860f72cf8715bc8c2724f1e2c860a25" }),
    summaryIntegrity: Object.freeze({ sha256: "22e54d99273da4757ffa16c70408ecb3c0cce54f1b9ddf5d7dda8279f84be1a5" }),
    summary: "Rysn y la tripulación del Vela Errante descubren el cadáver de un santhid flotando junto al barco. La superstición de los marineros amenaza con obligarlos a regresar, y Rysn sopesa si el hallazgo es un accidente o parte de la intimidación que rodea la misión. En lugar de ceder, reformula el hallazgo como una señal favorable y propone remolcar el cuerpo para darle un funeral digno, conservando el caparazón como testimonio. La capitana Dlrwan respalda la decisión y la tripulación empieza a preparar los garfios. Cuando intentan sujetar el cadáver, este se deshace de forma inesperada en una multitud de pequeños crustáceos, dejando a Rysn sin la explicación que esperaba.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-008.shallan-jasnah-pupil",
    kind: "event",
    aliases: Object.freeze(["aceptación de Shallan como pupila"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 8 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 8,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-021.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 9 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "1f9ad886ddb35ccb723890b8b8b4fd2c8f959182c26e0bef112a01d69736a156",
    }),
    summaryIntegrity: Object.freeze({ sha256: "299392b4fd7f2656a22c3b79f1b35dcac0c522b5c6306ebdf68062f275da673a" }),
    summary: "Tras un segundo rechazo inicial, Jasnah reconsidera su reacción y examina la carta y los materiales de Shallan. Reconoce su capacidad autodidacta y su habilidad argumentativa, pero condiciona una futura aceptación como pupila a que complete una formación más sólida en historia y filosofía. Consciente de que su familia no dispone de años para esperar, Shallan decide prepararse por su cuenta: con ayuda de Yalb localiza una librería, selecciona obras exigentes y negocia su compra frente a un comerciante condescendiente. De vuelta en el Palanaeum, empieza a estudiar cerca de Jasnah. La erudita revisa sus dibujos y cuadernos, valora que Shallan busque conocimiento por iniciativa propia y finalmente la acepta como ayudante y futura alumna, con la condición de comenzar al día siguiente.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-009.lift-nale-szeth",
    kind: "event",
    aliases: Object.freeze(["encuentro de Lift con Nale y Szeth"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 9 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 9,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/009.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 10 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "3561810a0d4efb150309a41393dd612a8edca55806c98395152e1b88e5e8949d",
    }),
    summaryIntegrity: Object.freeze({ sha256: "7ee2bd1f2a95b8e0e4d6ef9defa55a309581f1bb6c2ed1ca134e369ba9cbf9b2" }),
    summary: "Lift se infiltra en una reunión de los Rompedores del Cielo y escucha a Nale, a quien sus seguidores llaman Nin, instruir a dos iniciados sobre su misión de perseguir a quienes manifiestan poderes Radiantes. Nale justifica su postura por el temor a que el regreso de los vínculos con los spren desemboque en otra Desolación. Szeth, presente y todavía vinculado a su código, contradice esa interpretación: sostiene que los Portadores del Vacío han regresado y señala la nueva tormenta y los ojos rojos como indicios. Nale rechaza sus advertencias y ordena a los iniciados localizar a otra persona con poderes en la ciudad, mientras afirma que se ocupará personalmente de Lift al anochecer. Lift logra escapar, pero queda inquieta por la presencia de Szeth y por la identidad de Nale como Heraldo.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-009.rysn-aluminum-fabrial",
    kind: "event",
    aliases: Object.freeze(["experimento del fabrial de aluminio de Rysn"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 9 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 9,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/9.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 10 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "4ee69a012acd0e528aa63c5ac3f78cd22a0988e168f178606dc48a4691786906",
    }),
    summaryIntegrity: Object.freeze({ sha256: "1aa310d2444fbf84afad9783bd843a433fff9a2bb92ac293a08e08597937ae12" }),
    summary: "Rysn recibe de Vstim información que aclara parte del objetivo de la expedición: Akinah tuvo una Puerta Jurada y la misión debe investigar su estado, además de las señales de actividad enemiga. Las conversaciones con Nikli y Cuerda amplían las tradiciones sobre la antigua Aimia, sus artefactos y unas criaturas colectivas vinculadas a tesoros y pruebas; Rysn también considera la posibilidad de que el incidente del santhid fuera una ilusión. Mientras tanto, Rushu estudia una alteración accidental en un fabrial de rubíes parejos causada por aluminio. El experimento permite que la silla de Rysn conserve el movimiento vertical del ancla, pero adquiera desplazamiento horizontal independiente, una posibilidad que le ofrece una perspectiva de mayor autonomía. La emoción de Rysn ante esa mejora contrasta con la inquietud de Nikli, que sospecha que Cuerda podría estar ocultando sus motivos y pide que se investigue antes de continuar.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  })

  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-009.kaladin-recruit-death",
    kind: "event",
    aliases: Object.freeze(["muerte del recluta que recuerda a Tien"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 9 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 9,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-023.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 10 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945",
    }),
    summaryIntegrity: Object.freeze({ sha256: "6dc7e29663c7194cd10a37af3551e1aada86810594ad77e58acaacbdf78c5a0d" }),
    summary: "Durante una jornada de trabajo en el aserradero, Kaladin conversa con Syl y descubre que los recuerdos de ella sobre su pasado juntos son confusos. La llegada de nuevos reclutas al Puente Cuatro le hace fijarse en un muchacho que le recuerda a Tien. Aunque siente el impulso de protegerlo, la culpa por quienes no pudo salvar lo paraliza. Syl anuncia que debe marcharse porque no soporta seguir observando su sufrimiento y teme perderse si permanece a su lado. En la siguiente carrera, el joven muere y Kaladin queda devastado al encontrar su cuerpo junto al de otro compañero. Esa noche, mientras una alta tormenta golpea el barracón, rompe a llorar por primera vez en un año.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-010.lift-orphanage-reflection",
    kind: "event",
    aliases: Object.freeze(["reflexión de Lift en el orfanato"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 10 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 10,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/010.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 11 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf",
    }),
    summaryIntegrity: Object.freeze({ sha256: "f159a40c1e17a01ef67da4aeb81943913c86f565d5908a40577499b06d45dd3e" }),
    summary: "En el parque del orfanato, Lift observa a los niños y discute con Wyndle sobre su salida de Azir. Reconoce que, aunque decía huir de las expectativas del palacio, también temía que las personas llegaran a depender de ella. Cuando conoce a Mik, un niño abandonado que echa de menos a su madre, Lift le entrega parte de su comida y habla con él, mientras la conversación deja ver su propia dificultad para aceptar el cambio. Más tarde pregunta a un anciano misterioso cómo saber qué hacer con la vida. La respuesta, deliberadamente ambigua, gira en torno a la identidad, el tiempo limitado de las personas y la relación entre cada individuo y la ciudad. El capítulo profundiza en la resistencia de Lift a crecer y en su búsqueda de un propósito propio.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-010.rysn-arrests-nikli",
    kind: "event",
    aliases: Object.freeze(["detención de Nikli en el Vela Errante"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 10 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 10,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/10.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 11 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22",
    }),
    summaryIntegrity: Object.freeze({ sha256: "7e2809b9a96a6c6f3c2c1f73ae19c30a5be697917cf09e209d2ba4ee29219125" }),
    summary: "Rysn prueba el mecanismo giratorio y el contrapeso que Rushu y Huio han añadido a su silla flotante. La mejora le permite desplazarse por la cubierta con mayor autonomía y sentirse más conectada con la tripulación. Antes de acercarse a Akinah, comprueba que Cuerda desea continuar voluntariamente y escucha que la atraen los tesoros y la posibilidad de demostrar que puede sobrevivir a situaciones aterradoras. Nikli aparece con un saquito de ruinaoscura e intenta incriminar a Cuerda por la muerte de Aullido; Rysn revela que había preparado la situación para comprobar sus sospechas y ordena detenerlo. El registro posterior encuentra más veneno y un recetario con anotaciones inquietantes, lo que refuerza la sospecha de que Nikli planeaba sabotear a la tripulación. Como no puede determinar si posee poderes especiales, Rysn decide apartarlo a él y a Plamry del barco mientras la expedición continúa.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  })

  Object.freeze({
    schemaVersion: 1,
    id: "twok.chapter-010.kaladin-lirin-surgeon",
    kind: "event",
    aliases: Object.freeze(["Kal aprende cirugía con Lirin", "debate de Kal y Lirin sobre honor y guerra"]),
    firstSafeAppearance: Object.freeze({ bookId: "twok", chapter: 10 }),
    evidenceSource: Object.freeze({
      bookId: "twok",
      chapter: 10,
      locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-024.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "twok", chapter: 11 }),
    sourceIntegrity: Object.freeze({
      editionId: "roshar-omnibus-v1",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      documentSha256: "9c01e31f6d72a910dc1c742609aaf107eaf63f83bb94b4a681df39c8fc08995d",
    }),
    summaryIntegrity: Object.freeze({ sha256: "fca6e2195b7b80d51f75e7480f6bccb0040f02952620aca4f66a95ba750955f6" }),
    summary: "En un recuerdo de nueve años antes, Kal, de diez años, ayuda a su padre Lirin a tratar a Sani, una joven cuya mano ha quedado gravemente dañada. Kal aprende a mantener la calma durante una intervención y presencia la amputación de un dedo para salvar el resto de la mano. Tras la operación, Lirin cuestiona el deseo de Kal de convertirse en soldado y defiende que la función de un cirujano es salvar vidas, no quitarlas. Kal intenta argumentar que los soldados también protegen, pero su padre rechaza esa justificación y le propone formarse como cirujano en Kharbranth cuando tenga edad suficiente. El capítulo establece el conflicto temprano de Kal entre la vocación de sanar que su padre ve en él y su ideal de honor militar.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "edgedancer.chapter-011.lift-finds-great-indicium",
    kind: "event",
    aliases: Object.freeze(["Lift localiza el Gran Indicium"]),
    firstSafeAppearance: Object.freeze({ bookId: "edgedancer", chapter: 11 }),
    evidenceSource: Object.freeze({
      bookId: "edgedancer",
      chapter: 11,
      locatorId: "nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/011.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "edgedancer", chapter: 12 }),
    sourceIntegrity: Object.freeze({
      editionId: "edgedancer-epub-v1",
      navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      documentSha256: "1b3d61d87c1a1d7f14f7199996d7751b88c4a1b19f5a2fd808d1bcf8b72bd673",
    }),
    summaryIntegrity: Object.freeze({ sha256: "9e2e57a5717d63832ff1bb36014cffdae1870a189507dcc434c5f843c6628f72" }),
    summary: "Wyndle intenta explicar a Lift que su vínculo implica aceptar las Palabras, ideas vivas que permiten avanzar en su entrenamiento. Lift, sin embargo, sigue centrada en su propósito inmediato: impedir que Oscuridad ejecute a otra persona. En un jardín de la ciudad, razona que la cultura local registra y conserva información, así que busca un lugar donde se archiven los escritos. Negocia con una mujer a cambio de información y recibe la indicación del Gran Indicium, un edificio que parece reunir los registros de la ciudad. El capítulo muestra cómo Lift utiliza su observación práctica y su conocimiento de las costumbres locales para encontrar una pista, mientras evita abordar directamente el siguiente paso de su vínculo con Wyndle.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  }),
  Object.freeze({
    schemaVersion: 1,
    id: "dawnshard.chapter-011.lopen-crosses-akinah-storm",
    kind: "event",
    aliases: Object.freeze(["Lopen atraviesa la tormenta de Akinah"]),
    firstSafeAppearance: Object.freeze({ bookId: "dawnshard", chapter: 11 }),
    evidenceSource: Object.freeze({
      bookId: "dawnshard",
      chapter: 11,
      locatorId: "nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/11.xhtml",
    }),
    evidenceUnlock: Object.freeze({ bookId: "dawnshard", chapter: 12 }),
    sourceIntegrity: Object.freeze({
      editionId: "dawnshard-epub-v1",
      navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      documentSha256: "c12c49b2ad8813fe5d24894c6be43384e1da23875cf204e4129db9b5f20dddbc",
    }),
    summaryIntegrity: Object.freeze({ sha256: "adb307b600410e6022e783a0002adcc3187f508292f0c01f14e7e346523af12c" }),
    summary: "El Vela Errante entra en la tormenta que rodea Akinah. Lopen observa cómo los marineros maniobran el barco mediante remos, velas reducidas y fabriales para avanzar hacia el centro del fenómeno. Cuando Turlm cae por la borda, Lopen se lanza al agua y lo rescata con sus vínculos, pero durante la travesía detecta una criatura oscura que parece acechar el barco y que podría drenar la luz tormentosa. Tras atravesar la zona de mayor violencia, la tormenta amaina de forma abrupta y la tripulación alcanza aguas tranquilas. Al final, la isla de Akinah aparece ante ellos entre formaciones rocosas, confirmando que el destino de la expedición existe.",
    summaryKind: "original-editorial-summary",
    review: Object.freeze({ status: "pending-review" }),
  })
]);

// Chapter-N summaries remain locked until the reader reaches chapter N+1.
const VALIDATED_BATCH = validateHoidEditorialDraftBatch(RAW_DRAFTS);

/** Staging-only drafts; never passed to HoidEvidenceRuntime. */
export const HOID_EDITORIAL_DRAFTS: readonly HoidEditorialDraft[] =
  VALIDATED_BATCH.status === "valid" ? VALIDATED_BATCH.drafts : Object.freeze([]);

export function getHoidEditorialDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_BATCH.status === "invalid") return "invalid";
  return HOID_EDITORIAL_DRAFTS.length > 0 ? "pending-review" : "empty";
}
