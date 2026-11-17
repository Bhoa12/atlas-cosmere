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
 * First source-backed draft produced from the accessible El camino de los
 * reyes EPUB. It is pending review and is intentionally not imported by the
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
]);

const VALIDATED_BATCH = validateHoidEditorialDraftBatch(RAW_DRAFTS);

/** Staging-only drafts; never passed to HoidEvidenceRuntime. */
export const HOID_EDITORIAL_DRAFTS: readonly HoidEditorialDraft[] =
  VALIDATED_BATCH.status === "valid" ? VALIDATED_BATCH.drafts : Object.freeze([]);

export function getHoidEditorialDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_BATCH.status === "invalid") return "invalid";
  return HOID_EDITORIAL_DRAFTS.length > 0 ? "pending-review" : "empty";
}
