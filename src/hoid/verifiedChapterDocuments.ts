import { getVerifiedChapterLocatorId } from "./verifiedChapterLocators";

type VerifiedChapterDocumentSource = Readonly<{
  editionId: string;
  navigationSha256: string;
  documents: Readonly<Record<number, string>>;
}>;

/**
 * SHA-256 fingerprints of individual XHTML chapter documents inspected
 * directly from the private EPUBs. This is a deliberately sparse allowlist:
 * only chapters whose bytes were actually inspected appear here.
 *
 * No chapter text, title or extracted passage is stored.
 * Earlier runs added the initial sparse allowlist. Run 229 revalidated the four
 * supplied EPUB navigation documents and added the next exact XHTML digest for
 * El Imperio Final, El Camino de los Reyes, Danzante del Filo and Esquirla del amanecer.
 */
const VERIFIED: Readonly<Record<string, VerifiedChapterDocumentSource>> = Object.freeze({
  twok: Object.freeze({
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    documents: Object.freeze({
      1: "0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70",
      2: "5f76bd1de8106ebcba964f730368426fc22df1c2a7862e4f01dcf57ec0f63877",
      3: "aad893dde20e24a5444100d260f4d466f6ef553a13d676457d6f42015d774a0e",
      4: "1a5d55dd8eaa304b14a10526e50a98826de139abbc402013150dd795f44bef89",
      5: "1cc47f030de9132acec9b6eaca0310e325f4eb34d49bac7294611d09080d68d8",
      6: "9af4c12b07013a211fa399d6b53061c9207cfd49c42c56d89ded8cdc68c9c1c2",
      7: "30d9cecf9748261ad6e47fcea6064ac2f93ec523e8fe6a2d528d76306233bebb",
      8: "1f9ad886ddb35ccb723890b8b8b4fd2c8f959182c26e0bef112a01d69736a156",
      9: "c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945",
      10: "9c01e31f6d72a910dc1c742609aaf107eaf63f83bb94b4a681df39c8fc08995d",
      11: "3198740aafd799096672d6a893b925c08a4f33819219e7769761319eaea97ae5",
      12: "1f220d29b388c67834fb11d21fdb120407d1220531d735f946c00cc26223e838",
      13: "9716f41c822b8ea3801fd18d6072689d90482db419fd90d869fb12d8543da426",
      14: "6b5e5693ebbf7825cdbf9b0be1538641e8e412bfe8aba322453a80ec113d5e4e",
      15: "43ff1d4f608fb3ec230923d92edadd09bc3c9606d72d506b547c7be43266f492",
      16: "1f9d38db4cde7a471586ff7ed5d88cbef7a72b3616020ca1c4d8f06093e7da32",
      17: "c51c420645b3634d4c99791e215827fda7781a5f5d073ee8516673e61cb7d35e",
      18: "e8fec5f6b12f132a5469db8cc40afa90f31e675450c6b0f7050a64d94e6813cc",
    }),
  }),
  edgedancer: Object.freeze({
    editionId: "edgedancer-epub-v1",
    navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
    documents: Object.freeze({
      1: "8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc",
      2: "397c116112ca87b77cdd2c324156349594f47660d332a10417884119c8e7b0a0",
      3: "2a82686dd7fa7908d4b175f9b03f165309e08ccbb2294c6bcd32443b6d0d3905",
      4: "4437c0e0ff5a617490a087d7c887117e63ff5f6f627d5e9f4515206fb77a3507",
      5: "89da9c44aceb5254d8b29d63f9db940f0d13f6de03dc682883670fefd03dc83e",
      6: "b911d60b2e2630d79e6659a441ce4210e228b11c47ad6f9f026a9ce6b3c48de2",
      7: "c98233f98e7b5368a1e9e1d6db216ebbc4c22b43aa056624758a76ff67d7540f",
      8: "3b6e7ed84bcd4b08908f0f022edfc127b2dca223d834dc8841359fcb3ecbe095",
      9: "3561810a0d4efb150309a41393dd612a8edca55806c98395152e1b88e5e8949d",
      10: "4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf",
      11: "1b3d61d87c1a1d7f14f7199996d7751b88c4a1b19f5a2fd808d1bcf8b72bd673",
      12: "d02ecf9613cb9ae5ff8f95984b2a7bcdf56b19c72e9dcc6f193a1a959150155c",
      13: "341ffa8144efe7c054d92bbedd54246889a92b268db7b62118f6b651095a516d",
      14: "0c716a985a6f3ec2478788463d4b2ef132088829ce5d338101b0df9169edc17c",
      15: "0cf7efadeb8eae0c6c3563cb0bd5e7beef853bb1d75dfa69ba6734af7c7aa786",
      16: "d3a247b59d08735b83baa9840ef9e5058cc3f2108c931d66f06d370c4d41a4dd",
      17: "250c26f671df7422277711bbefd1f72a381a5dd1791bb28d9efb50e7e8c1352c",
      18: "fc630c1dccc3e10f77d857bf6d4680cf6a004def6f6a3a2d9810a8906219f671",
      19: "50771bbaad3f2767b1e4dd626b5bca7150ee980f858d83729d6469e70fefe9bd",
    }),
  }),
  dawnshard: Object.freeze({
    editionId: "dawnshard-epub-v1",
    navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
    documents: Object.freeze({
      1: "eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae",
      2: "511dd868f3feb65f3cc28566bbac167762ad70dddccffcae863be31e64f144dc",
      3: "709bca2ea215db4e90fc654b4b503a7c71d96bb40a508d5347ec83006b8cc286",
      4: "a283662ad3c34e67db60ec847fd8c4166725361d166a507c95245141ecedfcdb",
      5: "3aefc41eadb2b580c80d738552b3d10e1f93fd7c8755cf98b824e6922a9df515",
      6: "4025cf190a6b7d6e17d66036705f6aa1f16f3194b3964a29ea4aa77249a3bc3b",
      7: "c2d2eb939495f883a1d507a42728ca3f39b561534e6984de56af574872066aaf",
      8: "04cf11bf2784a7cc8b01cc226cb403744860f72cf8715bc8c2724f1e2c860a25",
      9: "4ee69a012acd0e528aa63c5ac3f78cd22a0988e168f178606dc48a4691786906",
      10: "0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22",
      11: "c12c49b2ad8813fe5d24894c6be43384e1da23875cf204e4129db9b5f20dddbc",
      12: "d5d73c0ebaaaeccf2dfbd2f16315aa521b860c043c0b61b971bbce76b7bc8990",
      13: "e0a97fb4d28b90b99169e6afcdf4fbd3e42b67c1ff5b0c61e0cb4aad6405544c",
      14: "c62b4deedaa65671b41e69e944a5fb384f71cbfef4807d7d7ffd013b21225fb5",
      15: "8ddd62ba14191c2a333e6da18beabc5205f50b6aa45472cfd16e25e6ba573dd5",
      16: "d62fefc1ce3e6eab0a0cfa5fa8e08819d5d5a9d3a2b2d12015ffaa9411cd18a2",
      17: "85fe1ee6a0224ef0ebc04c8f3e327e30a6553f2623a7482be66d5a4e1b2af840",
      18: "6025dc6682d083d272e1cc1899c978c2e99fa722b1a5dcb76aa634703342546b",
      19: "fdfdc11b97d409903be789ffd09b885bc3ab1c039cfae4ccbf4047005300bac6",
    }),
  }),
  tfe: Object.freeze({
    editionId: "cosmere-epub-merged-v1",
    navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
    documents: Object.freeze({
      1: "cfc6a6057a477cfba6e7795d30dca2324a97a5dbdefa86b6500aa437a625844a",
      2: "13604dc85df709443e6cd215a3e1a9deabe8f69f118dcc9823127b82ad486fc1",
      3: "bdbdd338d35c37d455c542384b51c4d67e7e46c1e4d2a5bf6d1535e02c4808c7",
      4: "6b729cfc609f926a4bac5b10f3eb5148a7c8935adde54f51f4ff13b9995b35d7",
      5: "ec48d5ed29ede0760a63d913fcc71d79c908d879fe62841fe6cbfc64d90676d8",
      6: "8b8596f106ac9f0510624c86849750358a934ab064036f91a70189378deda299",
      7: "fd79119ff64538b1d9fbe0d5d40ff9db8215afd144a27071c7c35b19b5ed1ac3",
      8: "5dc769cfdd8dfbfa91292ec9421b0ede94c8e1b05fd3560f9d9503b058e43d48",
      9: "e08f8b2845eb2d15ed9a1ad517d2207501ba0068f25797643e127919d92daedb",
      10: "a1a42419b3a0e8c63fdd15c6ec63d556dc11dfb3c3b9cffc04265d2c4a7ac472",
    }),
  }),
});

/**
 * Return a chapter-document digest only when both the edition-bound navigation
 * locator and the exact source-document digest were verified offline.
 */
export function getVerifiedChapterDocumentSha256(
  bookId: unknown,
  editionId: unknown,
  navigationSha256: unknown,
  chapterNumber: unknown,
): string | null {
  if (
    typeof bookId !== "string" ||
    typeof editionId !== "string" ||
    typeof navigationSha256 !== "string" ||
    typeof chapterNumber !== "number" ||
    !Number.isSafeInteger(chapterNumber) ||
    chapterNumber < 1
  ) return null;

  if (!Object.prototype.hasOwnProperty.call(VERIFIED, bookId)) return null;
  const source = VERIFIED[bookId];
  if (
    source.editionId !== editionId ||
    source.navigationSha256 !== navigationSha256 ||
    getVerifiedChapterLocatorId(bookId, editionId, navigationSha256, chapterNumber) === null
  ) return null;

  const digest = source.documents[chapterNumber];
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? digest
    : null;
}

/** Number of individually inspected chapter documents for one work. */
export function getVerifiedChapterDocumentCount(bookId: unknown): number {
  if (typeof bookId !== "string" || !Object.prototype.hasOwnProperty.call(VERIFIED, bookId)) return 0;
  return Object.keys(VERIFIED[bookId].documents).length;
}


/** Sorted, immutable chapter numbers whose original XHTML bytes were individually inspected. */
export function getVerifiedChapterDocumentNumbers(bookId: unknown): readonly number[] {
  if (typeof bookId !== "string" || !Object.prototype.hasOwnProperty.call(VERIFIED, bookId)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    Object.keys(VERIFIED[bookId].documents)
      .map(Number)
      .filter(number => Number.isSafeInteger(number) && number > 0)
      .sort((left, right) => left - right),
  );
}
