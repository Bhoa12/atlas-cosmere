import {
  createSafeAbstention,
  isSpoilerNeutralAbstention,
} from "./safeAbstention";

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const insufficient = createSafeAbstention();
expect(insufficient.mode === "abstain", "must abstain");
expect(isSpoilerNeutralAbstention(insufficient), "default must be spoiler-neutral");

const unsafe = createSafeAbstention("unsafe_context");
expect(isSpoilerNeutralAbstention(unsafe), "unsafe-context abstention must be neutral");

expect(
  !/cap[ií]tulo\s*\d+/i.test(unsafe.message),
  "must not disclose a future reading position",
);

console.log("safeAbstention self-check passed");
