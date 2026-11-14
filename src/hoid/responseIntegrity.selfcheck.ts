import { hasVerifiedAnswerIntegrity } from "./responseIntegrity";

const evidence = ["safe-a"] as const;
const accepted = {
  answer: "Primera afirmación. Segunda afirmación.",
  claims: [
    { text: "Primera afirmación.", evidenceIds: evidence },
    { text: "Segunda afirmación.", evidenceIds: evidence },
  ],
} as const;
const verified = {
  answer: accepted.answer,
  acceptedClaims: accepted.claims,
  rejectedClaims: 0,
} as const;

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

check(hasVerifiedAnswerIntegrity(accepted, verified), "Ordered verified claims must pass");
check(
  !hasVerifiedAnswerIntegrity(
    { ...accepted, answer: "Primera afirmación. Segunda afirmación. Detalle extra." },
    verified,
  ),
  "Unsupported prose must fail closed",
);
check(
  !hasVerifiedAnswerIntegrity(
    accepted,
    { ...verified, rejectedClaims: 1 },
  ),
  "A rejected claim must invalidate the complete answer",
);
