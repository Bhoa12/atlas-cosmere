import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const screenPath = fileURLToPath(new URL("../screens/HoidScreen.tsx", import.meta.url));

describe("Hoid progress timeline application wiring", () => {
  it("dispatches the timeline route through the application service", () => {
    const screen = readFileSync(screenPath, "utf8");

    expect(screen).toContain("createHoidEntityProgressTimelineApplicationAdapter({");
    expect(screen).toContain("entityProgressTimelineApplicationAdapter.execute(");
    expect(screen).toContain("activeEntityProgressTimelineDispatchRef.current = timelineDispatch;");
    expect(screen).toContain("entityProgressTimelineApplicationAdapter.invalidate();");
    expect(screen).not.toContain("entityProgressTimeline.answer({");
  });

  it("keeps the existing timeline adapter as the evidence and spoiler authority", () => {
    const screen = readFileSync(screenPath, "utf8");

    expect(screen).toContain("createHoidEntityProgressTimelineAdapter({");
    expect(screen).toContain("adapter: entityProgressTimeline,");
    expect(screen).toContain("bookScope: routeExecution.scope");
    expect(screen).toContain("progress: currentProgress");
    expect(screen).toContain("No recurriré a un proveedor ni inferiré una cronología.");
  });
});
