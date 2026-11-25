import { describe, expect, it } from "vitest";
import type { HoidTrustedConversationScreenPort } from "./trustedConversationScreenPort";
import type { HoidTrustedApplicationBootstrapSnapshot } from "./trustedApplicationBootstrap";
import { projectHoidTrustedApplicationScreen } from "./trustedApplicationScreenProjection";

describe("Hoid trusted application screen projection", () => {
  it("fails closed when no native bootstrap has been provisioned", () => {
    expect(projectHoidTrustedApplicationScreen(null)).toEqual({
      status: "unconfigured",
    });
  });

  it("projects idle and loading without exposing a screen capability", () => {
    expect(projectHoidTrustedApplicationScreen({ status: "idle" })).toEqual({
      status: "starting",
    });
    expect(projectHoidTrustedApplicationScreen({ status: "loading" })).toEqual({
      status: "loading",
    });
  });

  it("preserves the blocked reason and marks only explicit retry as available", () => {
    const reasons = [
      "invalid-dependencies",
      "progress-unavailable",
      "composition-unavailable",
      "screen-port-unavailable",
      "bootstrap-failed",
    ] as const;

    for (const reason of reasons) {
      expect(projectHoidTrustedApplicationScreen({ status: "blocked", reason })).toEqual({
        status: "blocked",
        reason,
        retryable: true,
      });
    }
  });

  it("forwards the exact bootstrap-owned port only in the ready state", () => {
    const screenPort = Object.freeze({}) as HoidTrustedConversationScreenPort;
    const snapshot: HoidTrustedApplicationBootstrapSnapshot = Object.freeze({
      status: "ready",
      screenPort,
    });

    const projection = projectHoidTrustedApplicationScreen(snapshot);
    expect(projection.status).toBe("ready");
    if (projection.status !== "ready") return;
    expect(projection.screenPort).toBe(screenPort);
  });

  it("keeps disposed as a terminal UI state", () => {
    expect(projectHoidTrustedApplicationScreen({ status: "disposed" })).toEqual({
      status: "disposed",
    });
  });
});
