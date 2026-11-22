import type {
  HoidEditionBoundRecommendation,
  HoidEditionBoundRecommendationResult,
  HoidRecommendationNavigationTarget,
  HoidResumeSelectionChoice,
} from "./editionBoundRecommendations";

export type HoidRecommendationExplanationCode =
  | "resume-current-cursor"
  | "start-first-numbered-chapter"
  | "catalog-only-unsegmented"
  | "catalog-only-unit-missing";

export type HoidExplainedRecommendation = Readonly<{
  sourceId: string;
  title: string;
  reason: HoidEditionBoundRecommendation["reason"];
  explanationCode: HoidRecommendationExplanationCode;
  heading: string;
  detail: string;
  target: HoidRecommendationNavigationTarget;
}>;

export type HoidExplainedResumeChoice = Readonly<{
  sourceId: string;
  title: string;
  currentChapter: number;
  completedThroughChapter: number | null;
  detail: string;
}>;

export type HoidExplainedRecommendationResult =
  | Readonly<{
      status: "ready";
      progressRevision: number;
      items: readonly HoidExplainedRecommendation[];
    }>
  | Readonly<{
      status: "selection-required";
      progressRevision: number;
      heading: string;
      detail: string;
      choices: readonly HoidExplainedResumeChoice[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "invalid-active-work";
    }>;

function explainTarget(target: HoidRecommendationNavigationTarget): string {
  if (target.kind === "catalog-only") {
    return target.reason === "segmentation-unverified"
      ? "La obra figura en el catálogo, pero su segmentación de capítulos no está verificada; no se inventa un capítulo ni una ruta de navegación."
      : "El manifiesto no contiene una unidad válida para este destino; no se inventa un localizador.";
  }

  if (target.locatorStatus === "cursor-only") {
    return "El cursor está vinculado a la edición y a su huella de navegación, pero no hay un localizador EPUB opaco verificado.";
  }

  return "El cursor y el localizador están vinculados al manifiesto y a la edición verificados.";
}

function explainRecommendation(
  item: HoidEditionBoundRecommendation,
): HoidExplainedRecommendation {
  if (item.reason === "resume-current-work") {
    const progressDetail = item.completedThroughChapter === null
      ? `No hay capítulos numerados completados; el cursor validado señala el capítulo ${item.currentChapter}.`
      : `El cursor validado señala el capítulo ${item.currentChapter}. El progreso registrado llega hasta el capítulo ${item.completedThroughChapter}.`;

    return Object.freeze({
      sourceId: item.sourceId,
      title: item.title,
      reason: item.reason,
      explanationCode: "resume-current-cursor",
      heading: `Reanudar ${item.title}`,
      detail: `${progressDetail} ${explainTarget(item.target)}`,
      target: item.target,
    });
  }

  if (item.target.kind === "catalog-only") {
    return Object.freeze({
      sourceId: item.sourceId,
      title: item.title,
      reason: item.reason,
      explanationCode: item.target.reason === "segmentation-unverified"
        ? "catalog-only-unsegmented"
        : "catalog-only-unit-missing",
      heading: `Consultar ${item.title} en el catálogo`,
      detail: explainTarget(item.target),
      target: item.target,
    });
  }

  return Object.freeze({
    sourceId: item.sourceId,
    title: item.title,
    reason: item.reason,
    explanationCode: "start-first-numbered-chapter",
    heading: `Empezar ${item.title}`,
    detail: `No hay progreso registrado para esta obra. El manifiesto de la edición permite iniciar por el capítulo 1. ${explainTarget(item.target)}`,
    target: item.target,
  });
}

function explainResumeChoice(choice: HoidResumeSelectionChoice): HoidExplainedResumeChoice {
  return Object.freeze({
    sourceId: choice.sourceId,
    title: choice.title,
    currentChapter: choice.currentChapter,
    completedThroughChapter: choice.completedThroughChapter,
    detail: choice.completedThroughChapter === null
      ? `El cursor está en el capítulo ${choice.currentChapter}; todavía no hay capítulos numerados completados.`
      : `El cursor está en el capítulo ${choice.currentChapter}; el progreso llega hasta el capítulo ${choice.completedThroughChapter}.`,
  });
}

/**
 * Add transparent, metadata-only explanations to the deterministic
 * edition-bound recommendation result.
 *
 * This formatter does not inspect narrative content, infer reading order,
 * authorize evidence, validate a cursor for navigation, or call a provider.
 * UI code must still pass the returned target through the normal cursor
 * validation/navigation boundary before opening a chapter.
 */
export function explainEditionBoundRecommendationResult(
  result: HoidEditionBoundRecommendationResult,
): HoidExplainedRecommendationResult {
  if (result.status === "unavailable") {
    return Object.freeze({
      status: "unavailable",
      reason: result.reason,
    });
  }

  if (result.status === "selection-required") {
    return Object.freeze({
      status: "selection-required",
      progressRevision: result.progressRevision,
      heading: "Elige qué obra quieres reanudar",
      detail: "Hay varias obras en curso. Hoid no elegirá una por ti ni sustituirá esa decisión por recomendaciones de descubrimiento.",
      choices: Object.freeze(result.choices.map(explainResumeChoice)),
    });
  }

  return Object.freeze({
    status: "ready",
    progressRevision: result.progressRevision,
    items: Object.freeze(result.items.map(explainRecommendation)),
  });
}
