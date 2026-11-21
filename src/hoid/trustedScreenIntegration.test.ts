import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const screenPath = fileURLToPath(new URL("../screens/HoidScreen.tsx", import.meta.url));
const appPath = fileURLToPath(new URL("../../App.tsx", import.meta.url));

describe("Hoid screen trusted presentation wiring", () => {
  it("requires the trusted answer port before dispatching narrative questions", () => {
    const screen = readFileSync(screenPath, "utf8");
    expect(screen).toContain("if (!trustedAnswerPort)");
    expect(screen).toContain("trustedAnswerPort.present(result.answer, result.depth)");
    expect(screen).not.toContain("presentHoidExplanation(");
  });

  it("keeps topic-derived narrative recommendations closed until their signed path exists", () => {
    const screen = readFileSync(screenPath, "utf8");
    expect(screen).toContain("const topicRecommendationsTrustReady = false");
    expect(screen).toContain("Las recomendaciones temáticas están temporalmente bloqueadas");
    expect(screen).toContain("topicRecommendationsTrustReady &&");
  });

  it("does not inject a synthetic or unprovisioned production presenter from App", () => {
    const app = readFileSync(appPath, "utf8");
    expect(app).toContain("<HoidScreen trustedAnswerPort={null} />");
  });
});
