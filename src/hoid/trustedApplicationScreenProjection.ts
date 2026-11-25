import type { HoidTrustedConversationScreenPort } from "./trustedConversationScreenPort";
import type {
  HoidTrustedApplicationBootstrapSnapshot,
} from "./trustedApplicationBootstrap";

/**
 * UI-safe projection of the application bootstrap lifecycle.
 *
 * This projection does not grant trust. The ready branch merely forwards the
 * branded screen capability created by the trusted bootstrap. HoidScreen
 * performs its own brand check before accepting that capability.
 */
export type HoidTrustedApplicationScreenProjection =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "starting" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{
      status: "ready";
      screenPort: HoidTrustedConversationScreenPort;
    }>
  | Readonly<{
      status: "blocked";
      reason: Extract<
        HoidTrustedApplicationBootstrapSnapshot,
        { status: "blocked" }
      >["reason"];
      retryable: true;
    }>
  | Readonly<{ status: "disposed" }>;

export function projectHoidTrustedApplicationScreen(
  snapshot: HoidTrustedApplicationBootstrapSnapshot | null,
): HoidTrustedApplicationScreenProjection {
  if (snapshot === null) return Object.freeze({ status: "unconfigured" });

  switch (snapshot.status) {
    case "idle":
      return Object.freeze({ status: "starting" });
    case "loading":
      return Object.freeze({ status: "loading" });
    case "ready":
      return Object.freeze({
        status: "ready",
        screenPort: snapshot.screenPort,
      });
    case "blocked":
      return Object.freeze({
        status: "blocked",
        reason: snapshot.reason,
        retryable: true,
      });
    case "disposed":
      return Object.freeze({ status: "disposed" });
    default: {
      const exhaustive: never = snapshot;
      return exhaustive;
    }
  }
}
