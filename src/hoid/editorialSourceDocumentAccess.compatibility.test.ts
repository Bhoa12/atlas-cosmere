import { describe, expect, it } from "vitest";
import type {
  HoidEditorialSourceDocumentAccessPort,
  HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";
import type {
  HoidEditorialSourceDocumentAccessPort as CanonicalPort,
  HoidEditorialSourceDocumentAccessRequest as CanonicalRequest,
} from "./editorialSourceDocumentAccess";

const request: HoidEditorialSourceDocumentAccessRequest = Object.freeze({
  bookId: "compatibility-fixture",
  editionId: "compatibility-edition",
  navigationSha256: "a".repeat(64),
  chapterNumber: 1,
  locatorId: "compatibility-chapter-1",
  expectedDocumentSha256: "b".repeat(64),
});

const canonicalRequest: CanonicalRequest = request;

const port: HoidEditorialSourceDocumentAccessPort = Object.freeze({
  inspectChapter: async (_request, _options) =>
    Object.freeze({ status: "unavailable", reason: "source-not-loaded" }),
});

const canonicalPort: CanonicalPort = port;

describe("editorial source document access compatibility exports", () => {
  it("keeps the legacy request export structurally identical to the canonical contract", () => {
    expect(canonicalRequest).toEqual(request);
  });

  it("keeps the legacy port export structurally identical to the canonical contract", () => {
    expect(canonicalPort).toBe(port);
  });
});
