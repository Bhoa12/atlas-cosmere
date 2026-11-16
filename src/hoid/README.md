# Hoid IA

Base desacoplada de proveedores para Atlas del Cosmere.

## Principio de seguridad

Hoid debe fallar de forma segura: si no puede determinar con certeza que un dato está desbloqueado para el progreso actual, no debe entregarlo.

El flujo previsto es:

`pregunta → autorización por libro/capítulo → contexto permitido → proveedor → filtro final con evidencia`

Cada frontera es independiente. Un proveedor nunca debe recibir contexto bloqueado, y su respuesta debe volver a pasar por un filtro antes de mostrarse.

## Progreso y aislamiento entre obras

El conocimiento se etiqueta con una obra y un capítulo de desbloqueo. La recuperación compara exclusivamente el progreso de esa misma obra: avanzar en otro libro no desbloquea contenido.

La integración con Atlas debe pasar por un adaptador de progreso. La interfaz de usuario no forma parte del núcleo de Hoid y los contratos internos no deben depender de React ni de un proveedor de IA concreto.

Las posiciones inválidas, desconocidas o ambiguas se tratan como no autorizadas.

La representación canónica del progreso usa un diccionario sin prototipo. Los identificadores externos, incluidos nombres especiales de propiedades de JavaScript, nunca deben modificar la herencia del estado de autorización.

### Validación estricta de snapshots

`validReadingPositions()` acepta exclusivamente objetos planos con claves conocidas y una de estas formas: capítulo, o finalización explícita. Un registro que combine `chapter` y `completed: true` es contradictorio y rechaza el snapshot completo. Tampoco se descartan silenciosamente posiciones malformadas para continuar con un progreso parcial.

La razón es de seguridad: `completed: true` autoriza toda la obra. Nunca puede inferirse a partir de un capítulo ni coexistir con él. La misma validación se aplica antes de respuestas y recomendaciones.

Consulta `docs/hoid/READING_SNAPSHOT_SECURITY.md` y `src/hoid/readingValidation.test.ts`.

## Proveedores

Los proveedores se consumen mediante contratos. El núcleo de Hoid no debe depender de una SDK concreta ni contener claves, configuración de red o lógica específica de un modelo.

Cuando no hay proveedor configurado o falla una llamada, el servicio debe comunicarlo explícitamente y no simular una respuesta de IA.

Las llamadas al proveedor también deben tener un límite temporal explícito en la frontera del servicio. Un timeout, rechazo o configuración de plazo inválida debe degradar a la misma respuesta conservadora de proveedor no disponible; nunca se muestra una salida parcial.

## Recomendaciones

Las recomendaciones actuales son deliberadamente conservadoras y se basan únicamente en metadatos del catálogo y en el progreso conocido.

No deben:

- copiar texto de los EPUB;
- inferir hechos argumentales desde fuentes no accesibles;
- afirmar dependencias o un orden de lectura canónico sin respaldo editorial verificado;
- usar progreso de identificadores que no pertenezcan al catálogo.

## Fuentes privadas

Las fuentes privadas se representan únicamente mediante metadatos, estructura de lectura y resúmenes originales respaldados. No se incluyen EPUBs ni texto protegido.

Un elemento de conocimiento debe incorporar una posición verificable antes de añadirse. Si el pasaje o la fuente no está accesible en el entorno, no se inventan hechos ni se afirma haberlo consultado.

## Pruebas mínimas

La cobertura debe incluir como mínimo:

- aislamiento de spoilers entre libros;
- preguntas que mezclan contenido permitido y bloqueado;
- bloqueo antes de llamar al proveedor;
- filtrado de spoilers introducidos por la salida del proveedor;
- progreso inválido o desconocido;
- recomendaciones limitadas a metadatos y obras verificadas.

Cualquier cambio futuro en la arquitectura debe conservar estas garantías antes de añadir capacidades de generación o recuperación más amplias.

## Modelo de amenazas y reglas de frontera

Las defensas anti-spoiler no deben depender de una única capa. Hoid trata como riesgos independientes: una pregunta que intenta inducir revelaciones futuras, un contexto recuperado con etiquetas erróneas, un proveedor que introduce información no autorizada y una integración que entrega progreso ambiguo.

Por ello, cada frontera debe aplicar estas reglas:

- **Entrada:** una petición no amplía por sí misma el conocimiento autorizado; el progreso es la única fuente de desbloqueo.
- **Recuperación:** cada elemento debe tener obra y posición de desbloqueo verificables; sin ambas, se excluye.
- **Proveedor:** recibe solo la pregunta y el contexto ya autorizado; nunca debe recibir una biblioteca completa como atajo.
- **Salida:** las afirmaciones factuales deben estar vinculadas a identificadores de conocimiento ya autorizado. El filtro final elimina las afirmaciones con evidencia desconocida, incompleta o bloqueada; tampoco deja pasar prosa libre del proveedor como si fuese conocimiento verificado. Si no existe un vínculo de evidencia por afirmación, se descarta y no se intenta completar ese hueco.
- **Degradación:** ante errores, datos incompletos o desacuerdo entre capas, Hoid reduce información en vez de ampliar el acceso.

Estas reglas también permiten sustituir o añadir proveedores sin cambiar la política de spoilers: el contrato del proveedor es una dependencia externa, mientras que la autorización y el filtrado pertenecen al núcleo.

## Contexto y respuestas adaptadas

La adaptación al lector debe producirse sin convertir el historial de lectura en una vía para ampliar conocimiento. El progreso normalizado es la única representación que usan recuperación y proveedores contextuales.

Las explicaciones deben distinguir entre información respaldada por el contexto autorizado y recomendaciones generales basadas en metadatos. Si Hoid no dispone de evidencia suficiente para responder con seguridad, debe reconocer el límite en lugar de completar huecos con hechos inventados.

El límite de contexto se aplica después de la autorización. Reducir el contexto nunca debe cambiar una entrada bloqueada en una autorizada.

### Invariantes para cambios futuros

- validar datos externos en tiempo de ejecución, aunque TypeScript declare un contrato;
- normalizar una vez las entradas de confianza y reutilizar la representación canónica;
- comprobar la salida del proveedor, incluso cuando su entrada haya sido segura;
- mantener pruebas separadas para autorización, recuperación, proveedores y filtros;
- documentar cualquier nueva capacidad de recuperación antes de conectarla a una fuente privada.

## Strict evidence-selection runtime

New integrations should prefer `HoidEvidenceRuntime` from `evidenceRuntime.ts` for narrative responses. Its provider is an ID-only selector: it can choose among locally approved original-editorial claims, but Hoid renders the exact claim text from the local registry. It never displays free-form model prose.

Every claim must cite evidence IDs, and every cited evidence item must be retrieved from verified, accessible, chapter-authorized context. Cross-book claims require every cited work and chapter to be unlocked. If no approved claim survives, the runtime abstains.

The older `HoidService` and `HoidPipeline` remain compatibility paths with different provider contracts. Do not assume they provide the same guarantee as the strict ID-only runtime. The strict runtime is not yet wired into `HoidScreen`; a verified editorial claim store and an injected selector adapter are still required.

## Chapter-bounded evidence

The strict evidence runtime distinguishes an entity's `firstSafeAppearance` from the unlock chapter of each complete editorial summary. Every strict-runtime knowledge entry must include a metadata-only `evidenceSource` (bibliography work, chapter and opaque locator) and an `evidenceUnlock` threshold. A summary is never released merely because its subject was mentioned earlier. Missing or malformed scope is rejected before provider invocation.

Authorized answers return metadata-only source citations. They identify the work, chapter and locator used without copying or exposing EPUB passages.

## Edition-aware progress

`editionStructure.ts` records metadata-only chapter counts and SHA-256 fingerprints of the EPUB navigation documents inspected for the supplied source editions. It stores no chapter titles, locators, summaries or narrative text.

`toHoidReadingPositions()` now applies those edition policies before the legacy UI progress enters the authorization pipeline. The strict runtime repeats the same checks through `validEditionBoundReadingPositions()`, so a direct caller cannot bypass the UI adapter. Unknown works, out-of-range chapters and ambiguous numeric positions are omitted at the adapter and rejected at the strict runtime boundary. The combined White Sand navigation and the multi-work Arcanum collection do not receive invented global chapter counts. Elantris and Viento y verdad are capped before their first duplicated chapter number until Atlas supplies an unambiguous unit locator.

See `docs/hoid/EDITION_STRUCTURE.md` for the inspected metadata, counts and explicit limitations.

## Versioned progress ledger

`progressLedger.ts` defines the provider-neutral `HoidProgressStore` contract and a versioned `HoidProgressLedger` service. Updates require the revision last read and use atomic compare-and-swap; stale writes return a conflict instead of overwriting another session.

The ledger rejects unknown works, malformed or duplicate positions, unsupported numeric progress for unsegmented collections, unconfirmed completion, unconfirmed regression and reopening without an explicit flag. Completion remains a reader-declared state and is not converted into an invented chapter number.

The contract does not itself provide durable storage. Atlas must inject a real adapter whose compare-and-swap operation is atomic across devices/sessions before the progress can be described as synchronized or persistent. See `docs/hoid/PROGRESS_LEDGER.md`.


### Progress ledger input boundary

`HoidProgressLedger` canonicalizes both updates and persisted snapshots before reading fields. It rejects accessors, symbols, inherited or unknown properties, sparse arrays and custom array properties; exceptions from hostile proxy traps are contained. JavaScript cannot reliably identify a transparent proxy, so callers and adapters must decode JSON into plain records before crossing this boundary. See `docs/hoid/PROGRESS_LEDGER_SECURITY.md` and `src/hoid/progressLedger.test.ts`.
