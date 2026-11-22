# Hoid metadata-only source ingestion plan

## Purpose

The source catalogue and offline EPUB inspection pipeline already distinguish edition metadata, navigation locators, inspected chapter bodies, editorial drafts and approved production knowledge. This module turns those records into a deterministic next-step queue so work can expand without guessing chapter paths or treating catalogue metadata as inspected narrative.

The plan is operational guidance only. It is not an evidence source, reading cursor, spoiler authorization or editorial approval.

## Current checked-in inventory

The plan is derived from the metadata-only coverage report and the exact edition-bound locator/document allowlists:

| Measure | Current value |
|---|---:|
| Catalogue works | 24 |
| Works with a safe next chapter-body inspection candidate | 19 |
| Continuations of already inspected works | 3 |
| New works ready to begin | 16 |
| Works blocked by unresolved segmentation | 4 |
| Individually inspected chapter documents | 66 |
| Original staged summaries | 62 |
| Summaries pending review | 62 |
| Numbered-chapter works with every current manifest unit inspected | 1 |
| Approved production claims | 0 |
| Production knowledge entries | 0 |

These counts describe checked-in metadata. They do not assert that a private EPUB is currently selected or accessible.

## Deterministic priority

Tasks are ordered as follows:

1. Continue a work that already has individually inspected chapter documents, choosing the work with the smallest inspected count first.
2. Start other Cosmere works in canonical bibliography order.
3. Start other Roshar works in canonical bibliography order.

The current continuation candidates are:

| Work | Next chapter to inspect |
|---|---:|
| El Imperio Final | 11 |
| El Camino de los Reyes | 19 |
| Danzante del Filo | 20 |

Esquirla del amanecer has all 19 numbered manifest chapters fingerprinted and is reported as completed within the `numbered-chapters-only` scope; this does not claim that unmodelled front/back matter or narrative evidence is complete. The other 16 candidates begin at chapter 1. Elantris and Viento y Verdad are eligible only within their already verified safe numeric prefixes (1–47 and 1–11 respectively). When those prefixes are fully inspected, the planner blocks further numeric work until the duplicate chapter locators are resolved.

Arena blanca vol. 1–3 remain blocked until each volume is segmented independently. Arcanum ilimitado remains blocked until its internal works/sections receive independent units.

## Candidate contract

Each task contains only:

- canonical work ID and title;
- source group and exact edition ID;
- chapter number;
- exact verified locator ID and its relative archive href;
- safe manifest coverage and counts;
- priority;
- an explicit local-source-selection requirement;
- the minimum reader chapter at which a future chapter-N summary could be unlocked (N+1).

The source-availability field is always not-checked. The planner does not receive a device URI, read archive bytes, inspect XHTML, or claim that the source file is present.

A consumer must still:
1. ask the reader to explicitly select the local EPUB;
2. bind that selection to the canonical work and registered edition;
3. run the candidate-only package inspection;
4. inspect only the exact navigation-backed XHTML target;
5. independently review the resulting digest and original summary before adding anything to editorial staging.

## Blocked and completed work

The planner reports unresolved volume segmentation, collection-section segmentation, missing/invalid locators, inconsistent coverage and ambiguous numbering as explicit blockers. It never fills gaps by synthesizing hrefs or guessing section boundaries.

A completed work means only that every numbered unit in its current manifest has an inspected document. It does not imply coverage of prologues, interludes, epilogues, appendices, illustrations or other unmodelled sections.

## Editorial and spoiler boundaries

- Existing staged summaries remain pending review.
- The plan does not expose summary prose, source passages, document hashes or private URIs.
- It does not approve claims or write to the production registry.
- A chapter-N inspection task sets its future minimum reader chapter to N+1; opening chapter N is not treated as completion.
- Each work retains its own reading boundary. A cursor in one book cannot authorize another book.
- EvidenceRuntime remains the only narrative authorization boundary.

## Implementation

- src/hoid/sourceIngestionPlan.ts builds the immutable, deterministic plan.
- src/hoid/sourceIngestionPlan.test.ts asserts task counts, priority, exact continuation chapters, partial safe prefixes, segmentation blockers, relative locator shape, next-chapter unlock and production isolation.
- hoid-source-ingestion-plan.yml runs the planner, source coverage, locator and manifest regressions with strict TypeScript checking.

## Scope of Run 165 (historical)

This run adds the metadata-only planner and tests, then separately uses the explicit local-source inspection process for three available Roshar EPUB chapters. The planner itself does not read source bytes or authorize evidence. The six inspected chapter digests and original summaries are recorded in the sparse allowlist and staging only; no progress is changed, no claim is approved and no production knowledge is written. No EPUB, XHTML, extracted passage or private file URI is committed.


## Run 168 — refreshed continuation queue

After inspecting El Imperio Final chapter 4, El Camino de los Reyes chapter 11, Danzante del Filo chapter 12 and Esquirla del amanecer chapter 12, the deterministic continuation queue advances to:

| Work | Next chapter to inspect |
|---|---:|
| El Imperio Final | 5 |
| El Camino de los Reyes | 12 |
| Danzante del Filo | 13 |
| Esquirla del amanecer | 13 |

The queue remains metadata-only. Each candidate still requires explicit local EPUB selection, exact edition binding and candidate-only inspection. It does not read sources or authorize evidence by itself.


## Cursor versus evidence watermark

`minimumReaderChapter` in an ingestion task is the open cursor chapter N+1. The evidence record stores the completed-through watermark N. Keep these coordinates separate: reaching cursor N+1 completes source chapter N; it does not require completing chapter N+1.


## Run 170 — refreshed continuation queue

After inspecting El Imperio Final chapter 5, El Camino de los Reyes chapter 12, Danzante del Filo chapter 13 and Esquirla del amanecer chapter 13, the next continuation candidates are:

| Work | Next chapter to inspect |
|---|---:|
| El Imperio Final | 6 |
| El Camino de los Reyes | 13 |
| Danzante del Filo | 14 |
| Esquirla del amanecer | 14 |

The planner remains metadata-only. It records candidate locators and the minimum open cursor N+1; the editorial evidence record stores the completed-through watermark N. Every candidate still requires explicit local source selection and candidate-only inspection. The four Run 170 summaries remain pending review and production remains empty.


## Run 174 — refreshed continuation queue

After inspecting El Camino de los Reyes chapter 13, Danzante del Filo chapter 14 and Esquirla del amanecer chapter 14, the continuation candidates are El Imperio Final chapter 6, El Camino de los Reyes chapter 14, Danzante del Filo chapter 15 and Esquirla del amanecer chapter 15. These are metadata-only candidates; the current Library listing did not contain `cosmere.epub`, so the Cosmere continuation remains uninspected until that exact source is available.


## Ejecución local de una tarea del plan

Run 175 añade `inspectHoidPlannedChapterCandidate`, que conecta una tarea vigente con una selección explícita de EPUB local y un candidato de paquete emitido por la misma instancia del servicio de ingesta. Vuelve a comprobar la tarea canónica, la obra, el grupo de fuente, la edición, el localizador exacto, la huella de navegación y la identidad del candidato.

El resultado es exclusivamente `candidate-only`: contiene localizador, tamaño y huellas SHA-256. No contiene texto ni bytes del capítulo, no genera resúmenes, no añade documentos a la allowlist, no modifica progreso y no promueve conocimiento. El panel Expo permite ejecutar la siguiente tarea y muestra solo el número del capítulo y una huella parcial.


## Run 175 — cola de continuación actualizada

Tras inspeccionar El Imperio Final capítulo 6, El Camino de los Reyes capítulo 14, Danzante del Filo capítulo 15 y Esquirla del amanecer capítulo 15, las siguientes tareas candidatas son:

| Obra | Próximo capítulo |
|---|---:|
| El Imperio Final | 7 |
| El Camino de los Reyes | 15 |
| Danzante del Filo | 16 |
| Esquirla del amanecer | 16 |

En esta ejecución `cosmere.epub` sí estuvo disponible en la biblioteca y su navegación coincidió con la edición registrada. La tarea del plan sigue siendo metadata-only y exige selección local explícita. La inspección candidate-only no escribe texto ni autoriza conocimiento.


## Run 176 — cola de continuación actualizada

Tras inspeccionar El Camino de los Reyes capítulo 15, Danzante del Filo capítulo 16 y Esquirla del amanecer capítulo 16, la siguiente cola de continuación es:

| Obra | Próximo capítulo candidato |
|---|---:|
| El Imperio Final | 7 |
| El Camino de los Reyes | 16 |
| Danzante del Filo | 17 |
| Esquirla del amanecer | 17 |

La inspección de los tres EPUBs de Roshar confirmó que sus huellas de navegación seguían coincidiendo con las ediciones registradas y que los XHTML previos continuaban teniendo los digests esperados. `cosmere.epub` no apareció en el inventario actual de Library ni en la búsqueda de archivos de conversación; El Imperio Final capítulo 7 no se inspeccionó. El plan permanece metadata-only y no afirma disponibilidad ni autorización.


## Run 178 — cola de continuación actualizada

Se encontró la copia privada `cosmere.epub` en Library y se revalidó su integridad ZIP y el digest de navegación registrado. El capítulo 7 de El Imperio Final se resolvió mediante su TOC, se confirmó en el manifiesto OPF y en el reading spine, y se fingerprintó desde sus bytes XHTML. La cola de continuación pasa a El Imperio Final capítulo 8, El Camino de los Reyes capítulo 16, Danzante del Filo capítulo 17 y Esquirla del amanecer capítulo 17.

El plan sigue siendo metadata-only: registra candidatos y umbrales N+1, pero no autoriza evidencia ni modifica el progreso. El resumen del capítulo 7 permanece en revisión independiente.


## Run 181 — cola de continuación actualizada

Tras inspeccionar El Imperio Final capítulo 8 desde la copia privada accesible de `cosmere.epub`, la cola de continuación queda así:

| Obra | Próximo capítulo candidato |
|---|---:|
| El Imperio Final | 9 |
| El Camino de los Reyes | 16 |
| Danzante del Filo | 17 |
| Esquirla del amanecer | 17 |

El plan sigue siendo metadata-only. Registra el siguiente candidato y el umbral N+1, pero no autoriza evidencia ni modifica el progreso. La disponibilidad del EPUB se verificó por separado durante la inspección; el plan no conserva rutas privadas ni afirma disponibilidad futura.

## Run 191 — refreshed continuation queue

After inspecting El Camino de los Reyes chapter 16, Danzante del Filo chapter 17 and Esquirla del amanecer chapter 17, the current continuation candidates are:

| Work | Next chapter to inspect |
|---|---:|
| El Imperio Final | 9 |
| El Camino de los Reyes | 17 |
| Danzante del Filo | 18 |
| Esquirla del amanecer | 18 |

The planner remains metadata-only. The three new chapter-N summaries carry completed-through watermark N and require the reader to reach chapter N+1 before they can be unlocked. All three remain pending editorial review; production knowledge is unchanged. The current Library inventory used in this run did not include `cosmere.epub`, so El Imperio Final chapter 9 remains a metadata-only candidate and no TFE passage was inspected.



## Run 192 — El Imperio Final chapter 9 inspected

The Library now contains the user's `cosmere.epub` source. Run 192 explicitly selected that file and verified the registered navigation digest, the existing chapter-eight document digest, the chapter-nine navigation href, its unique OPF manifest item, reading-spine membership and exact XHTML SHA-256. The source planner remains metadata-only; it did not inspect the archive or authorize evidence.

The chapter-nine original summary is staged separately with completed-through watermark 9 and minimum open reader cursor 10. It remains pending editorial review and is excluded from production knowledge. The deterministic continuation queue now advances El Imperio Final to chapter 10; the other existing continuations remain El Camino de los Reyes 17, Danzante del Filo 18 and Esquirla del amanecer 18.


## Run 194 — Roshar continuation

The exact Library EPUB copies for the Roshar omnibus, Danzante del Filo and Esquirla del amanecer were rechecked. Their registered navigation SHA-256 values still match. For each work, the immediately preceding chapter document matched its existing allowlisted digest, and the next chapter target was confirmed as a single TOC entry, a unique OPF manifest item and a member of the reading spine.

Three chapter bodies were inspected and staged as original summaries:

| Work | Chapter inspected | Next candidate | Earliest unlock cursor |
|---|---:|---:|---:|
| El Camino de los Reyes | 17 | 18 | 18 |
| Danzante del Filo | 18 | 19 | 19 |
| Esquirla del amanecer | 18 | 19 | 19 |

The next deterministic continuation queue is El Imperio Final chapter 10, El Camino de los Reyes chapter 18, Danzante del Filo chapter 19 and Esquirla del amanecer chapter 19. The current Library EPUB filter did not return `cosmere.epub`; TFE chapter 10 remains a candidate only.

All three new summaries remain pending review. The ingestion planner still has no authorization effect and does not claim source availability.


## Run 229 — refreshed continuation queue

Run 229 revalidated the four local EPUB edition fingerprints and added the next exact XHTML document digest for El Imperio Final chapter 10, El Camino de los Reyes chapter 18, Danzante del Filo chapter 19 and Esquirla del amanecer chapter 19. Each target was confirmed in navigation, the OPF manifest and the reading spine; the preceding chapter digest also matched.

The current planner therefore exposes three continuation candidates: El Imperio Final chapter 11, El Camino de los Reyes chapter 19 and Danzante del Filo chapter 20. Esquirla del amanecer moves to `completedWorks` only because all 19 numbered units in its current manifest have document fingerprints. This is not a claim of complete book coverage or editorial knowledge.

The staging inventory remains 62 original summaries, all pending review. Run 229 did not create a summary, promote a claim, change progress or activate production knowledge. The planner remains metadata-only and source availability remains unchecked.
