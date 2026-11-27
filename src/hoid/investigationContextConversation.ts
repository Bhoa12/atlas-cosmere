import {
  buildProductionHoidAuthorizedKnowledgeGraph,
  isHoidAuthorizedKnowledgeGraphResult,
} from "./knowledgeGraph";
import {
  createProductionHoidInvestigationContextPresenter,
  isHoidInvestigationContextPresenter,
  type HoidInvestigationContextPresentationResult,
} from "./investigationContextPresentation";

export type HoidInvestigationContextConversationAdapter = Readonly<{
  /**
   * Builds the graph from the source-controlled production registries and
   * delegates the only user-facing projection to the locally branded presenter.
   * Callers cannot supply a graph, labels, claims or provider-authored prose.
   */
  present(input: unknown): HoidInvestigationContextPresentationResult;
}>;

const ADAPTERS = new WeakSet<object>();

function exactRequest(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 ||
        !keys.includes("progress") ||
        !keys.includes("history") ||
        !keys.includes("bookScope")) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (key !== "progress" && key !== "history" && key !== "bookScope") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function unavailable(
  reason: "invalid-request" | "invalid-graph",
): HoidInvestigationContextPresentationResult {
  return Object.freeze({ status: "unavailable", reason });
}

/**
 * Production conversation boundary for accumulated context.
 *
 * The graph is always rebuilt locally from reviewed source-controlled data.
 * The adapter deliberately has no provider port and accepts no graph-shaped
 * input, so a provider cannot manufacture a relation or disclosure label.
 */
export function createProductionHoidInvestigationContextConversationAdapter(
  getCurrentProgress: () => unknown,
): HoidInvestigationContextConversationAdapter | null {
  const presenter = createProductionHoidInvestigationContextPresenter(getCurrentProgress);
  if (!isHoidInvestigationContextPresenter(presenter)) return null;

  const adapter: HoidInvestigationContextConversationAdapter = Object.freeze({
    present(input: unknown): HoidInvestigationContextPresentationResult {
      const request = exactRequest(input);
      if (!request) return unavailable("invalid-request");

      try {
        const graph = buildProductionHoidAuthorizedKnowledgeGraph(request.progress);
        if (!isHoidAuthorizedKnowledgeGraphResult(graph)) {
          return unavailable("invalid-graph");
        }
        return presenter.present({
          graph,
          history: request.history,
          bookScope: request.bookScope,
        });
      } catch {
        return unavailable("invalid-graph");
      }
    },
  });

  ADAPTERS.add(adapter as object);
  return adapter;
}

export function isHoidInvestigationContextConversationAdapter(
  value: unknown,
): value is HoidInvestigationContextConversationAdapter {
  return value !== null && typeof value === "object" && ADAPTERS.has(value as object);
}
