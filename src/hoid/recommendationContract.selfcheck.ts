import { verifyRecommendationAtomically } from "./recommendationContract";

const allowed = new Set(["mistborn:1:ch:10", "stormlight:1:ch:5"]);

function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

expect(
  verifyRecommendationAtomically(
    { items: [{ text: "Puedes revisar los conceptos ya introducidos.", evidenceIds: ["mistborn:1:ch:10"] }] },
    allowed,
  ).accepted,
  "A supported recommendation should be accepted",
);

expect(
  !verifyRecommendationAtomically(
    {
      items: [
        { text: "Consejo respaldado.", evidenceIds: ["mistborn:1:ch:10"] },
        { text: "Consejo con contexto futuro.", evidenceIds: ["mistborn:1:ch:99"] },
      ],
    },
    allowed,
  ).accepted,
  "A mixed recommendation must be rejected atomically",
);

expect(
  !verifyRecommendationAtomically(
    { items: [{ text: "Consejo sin respaldo.", evidenceIds: [] }] },
    allowed,
  ).accepted,
  "Unsupported recommendations must be rejected",
);
