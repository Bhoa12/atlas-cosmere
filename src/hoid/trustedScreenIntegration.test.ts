import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const screenPath = fileURLToPath(new URL("../screens/HoidScreen.tsx", import.meta.url));
const hostPath = fileURLToPath(new URL("../screens/HoidTrustedScreenHost.tsx", import.meta.url));
const appPath = fileURLToPath(new URL("../../App.tsx", import.meta.url));

describe("Hoid screen trusted presentation wiring", () => {
  it("requires the trusted exact-unit v3 port before dispatching narrative questions", () => {
    const screen = readFileSync(screenPath, "utf8");
    expect(screen).toContain("if (!trustedConversationPort)");
    expect(screen).toContain("trustedConversationPort.send({");
    expect(screen).toContain("trustedConversationPort?.resetContext");
    expect(screen).toContain("result.presentation.text");
    expect(screen).not.toContain("conversationGateway.answer(");
    expect(screen).not.toContain("trustedAnswerPort.present(");
    expect(screen).not.toContain("presentHoidExplanation(");
  });

  it("routes topic recommendations through the signed presenter and keeps trust bindings outside React state", () => {
    const screen = readFileSync(screenPath, "utf8");
    expect(screen).toContain("createHoidTrustedTopicRecommendationPresenter({");
    expect(screen).toContain("const topicRecommendationsTrustReady = trustedTopicRecommendationPresenter !== null");
    expect(screen).toContain("if (!topicRecommendationsTrustReady || !trustedAnswerPort || !trustedTopicRecommendationPresenter)");
    expect(screen).toContain("trustedTopicRecommendationPresenter.present({");

    // The UI stores only the minimized projection. Freshness and presenter
    // identity remain in an ephemeral ref and are checked on every render.
    expect(screen).toContain("const [topicRecommendations, setTopicRecommendations] = useState<readonly HoidTopicRecommendationDisplayItem[]>([]);");
    expect(screen).toContain("topicRecommendationBindingRef.current = Object.freeze({");
    expect(screen).toContain("topicRecommendationBinding.trustPort === trustedAnswerPort");
    expect(screen).toContain("setTopicRecommendations(topicDisplayItems)");
    expect(screen).toContain("topicRecommendationBindingRef.current = null;");
    expect(screen).toContain("liveProgressScope?.revision, liveProgressScope?.fingerprint, progresoPersistenciaEstado, trustedAnswerPort, trustedConversationPort");
    expect(screen).toContain("trustedConversationPort?.dispose");
    expect(screen).not.toContain("setTopicRecommendationTrustPort(");
    expect(screen).not.toContain("const [topicRecommendationTrustPort");
    expect(screen).not.toContain("const [topicRecommendationRevision");
    expect(screen).not.toContain("const [topicRecommendationFingerprint");
    expect(screen).not.toContain("const topicRecommendationsTrustReady = false");
  });

  it("routes App through a screen-scoped bootstrap owner without inventing trust dependencies", () => {
    const app = readFileSync(appPath, "utf8");
    const host = readFileSync(hostPath, "utf8");
    expect(app).toContain("import { HoidTrustedScreenHost } from './src/screens/HoidTrustedScreenHost';");
    expect(app).toContain("<HoidTrustedScreenHost createBootstrap={null} />");
    expect(app).not.toContain("<HoidScreen ");

    // A mounted Hoid screen owns a fresh bootstrap. This matches HoidScreen's
    // existing disposal of the port it receives when the tab unmounts.
    expect(host).toContain("createBootstrap?.()");
    expect(host).toContain("ownedBootstrap?.dispose()");
    expect(host).toContain("trustedAnswerPort={null}");
    expect(host).toContain("trustedConversationPort={screenPort}");
  });
});
