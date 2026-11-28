import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationPorts,
} from "./conversationApplicationService";
import type { HoidConversationRouteExecutionInput } from "./conversationRouteExecution";
import type { HoidExplanationDepth } from "./explanationDepth";
import type {
  HoidTrustedConversationScreenPort,
  HoidTrustedConversationScreenResult,
} from "./trustedConversationScreenPort";

export type HoidTrustedConversationApplicationDispatch = Readonly<{
  port: HoidTrustedConversationScreenPort;
  question: string;
  depth: HoidExplanationDepth;
  isCurrent: () => boolean;
}>;

export type HoidTrustedConversationApplicationAdapterPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidTrustedConversationScreenResult>["readProgress"];
  getCurrentDispatch: () => HoidTrustedConversationApplicationDispatch | null;
}>;

/**
 * Connects only the already-branded exact-unit screen port to the application
 * service. The UI owns the active dispatch snapshot; this adapter never chooses
 * a provider and never exposes raw evidence or provider output.
 */
export function createHoidTrustedConversationApplicationAdapter(
  ports: HoidTrustedConversationApplicationAdapterPorts,
) {
  if (
    ports === null ||
    typeof ports !== "object" ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid trusted conversation application adapter ports");

  return createHoidConversationApplicationService<HoidTrustedConversationScreenResult>({
    readProgress: ports.readProgress,
    executeRoute: (execution, _context, signal) => {
      if (execution.route !== "conversation") {
        throw new Error("Trusted conversation adapter received a non-conversation route");
      }
      if (signal?.aborted) throw new Error("Trusted conversation dispatch was cancelled");

      const dispatch = ports.getCurrentDispatch();
      if (
        !dispatch ||
        typeof dispatch.question !== "string" ||
        dispatch.question.trim().length === 0 ||
        typeof dispatch.isCurrent !== "function" ||
        dispatch.isCurrent() !== true
      ) throw new Error("No current trusted conversation dispatch is available");

      return dispatch.port.send({
        question: dispatch.question,
        intent: execution.intent.intent,
        depth: dispatch.depth,
        bookScope: execution.scope,
      }, signal ? { signal } : undefined);
    },
  });
}

export type HoidTrustedConversationApplicationRouteInput =
  HoidConversationRouteExecutionInput;
