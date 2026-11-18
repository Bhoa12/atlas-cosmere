# Run 128 — bounded multi-entity explanations

## Purpose

Extend the existing progress-bound relationship route from exactly two entities to a bounded group of two to four exact, reviewed, currently disclosed entity aliases.

Two entities retain the existing single-pair behavior. Three or four entities are decomposed into a deterministic complete pairwise matrix in the order the aliases occur in the question.

## Pairwise contract

For a group of N entities, the gateway evaluates N × (N - 1) / 2 unordered pairs. Each pair receives one directed graph query (depth 4, one path). The reverse direction is attempted only when the first direction returns a valid no-path result for the same progress revision and fingerprint.

A group is returned only when every pair has a valid explanation. If any pair has no path, the complete request returns no-path; it never returns a partial matrix. A malformed, stale, truncated or unavailable pair blocks the complete request.

The maximum group size is four, so the maximum is six pairwise graph explanations and at most twelve directed graph queries. Groups larger than four remain ambiguous and are not sent to the graph.

## Composition and integrity

Every pair result is revalidated before composition:

- exact progress revision and SHA-256 fingerprint;
- exact response envelope and allowed fields;
- non-truncated explanation;
- stable plan ID;
- bounded, dense segment and source arrays;
- unique claim IDs within each pair;
- exact segment evidence-ID/source correspondence;
- source metadata shape and SHA-256 formats;
- exact segment-text concatenation.

The aggregate deduplicates identical claim IDs only when the complete segment fingerprint is identical. A repeated claim ID with different text, evidence IDs or source metadata rejects the whole aggregate. Evidence IDs are similarly deduplicated only when their complete source fingerprints match.

The aggregate plan ID is a deterministic SHA-256 digest of the ordered entity IDs and ordered pair plan IDs. The final output remains the existing HoidRenderedExplanation contract, so the downstream relationship presentation layer rechecks the bibliography, edition, navigation digest, chapter locator, document digest and every unlock threshold against the same cursor snapshot.

## Spoiler and failure policy

- All entity and alias disclosures are resolved once against the original question and current progress before graph work.
- The mention resolver's blocked/ambiguous result blocks the entire group.
- No fuzzy alias matching or provider-generated entity identifiers are accepted.
- Every pair is independently authorized by the existing graph planner and explanation renderer.
- Progress is checked before resolution and after all pair queries. The downstream conversation gateway and UI perform their existing additional freshness checks.
- No partial explanation or source list is returned.
- Recognized relationship questions never fall back to a general language-model selector when the group is unsupported.

## Limits

| Limit | Value |
|---|---:|
| Entities per group | 2–4 |
| Pairwise graph paths | 1 per unordered pair |
| Maximum unordered pairs | 6 |
| Maximum directed queries | 12 |
| Graph depth per direction | 4 |
| Aggregate segments | 12 |
| Aggregate evidence sources | 16 |
| Aggregate text | 32,000 characters |

## Production status

The production editorial, approved-claim and alias registries remain empty pending source-backed independent review. Therefore the multi-entity route is integrated but production questions continue to abstain until reviewed records are promoted. Synthetic tests exercise the successful path and do not add Cosmere facts or populate production registries.

## Intellectual property

Only original reviewed claims, metadata, opaque locators and integrity digests are used. No EPUB bytes, XHTML bodies, extracted passages, copied narrative text or images are committed.