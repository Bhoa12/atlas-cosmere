# Roshar — backlog técnico y contrato de datos

> Documento de planificación. No modifica el comportamiento de la aplicación. La implementación se realizará en `fix/atlas-core-audit`; `main` permanecerá intacta.

## Objetivo y alcance

Construir Roshar como piloto de una enciclopedia Cosmere progresiva, verificable y resistente a spoilers. El contenido se desbloquea por **afirmación individual y unidad de lectura**, no por ficha completa ni por libro terminado.

Obras iniciales del alcance:
- El camino de los reyes (`twok`)
- Palabras radiantes (`wor`)
- Danzante del filo (`edgedancer`)
- Juramentada (ID legado actual: `o`; no renombrar sin migración)
- Esquirla del amanecer (`dawnshard`)
- El ritmo de la guerra (`row`)
- Viento y verdad (`wat`)

Los IDs actuales se consideran contratos de persistencia. Se pueden añadir identificadores canónicos nuevos, pero no sustituir los IDs legados sin una migración versionada.

## Diagnóstico del estado actual

Inspección realizada en `fix/atlas-core-audit`:
- `src/data/cosmereUniverse.ts`: `Libro.totalCapitulos` es un entero; no representa prólogos, interludios, epílogos ni unidades editoriales independientes. Roshar tiene siete obras en el catálogo, pero no una tabla de secciones.
- `SistemaPlanetario` concentra `mapaTerritorial`, `climaYTiempo`, `faunaFlora` y `sistemasMagicos` en campos de texto/listas embebidos. Las entradas de flora/fauna y magia solo tienen `desbloqueoLibroId`, por lo que el desbloqueo es demasiado grueso.
- Las fichas de libro contienen `personajesClave` con nombre y rol, no fichas de personaje ni apariciones por sección.
- `src/context/CosmereContext.tsx` guarda `capituloActualPorLibro: Record<string, number>` y `librosLeidos`; `esContenidoDesbloqueado` comprueba únicamente si un libro está terminado.
- El estado inicial del contexto contiene lecturas y capítulos de demostración (`tfe`, `twok`). Deben separarse los datos de demostración del progreso real antes de ampliar el sistema.
- `App.tsx` presenta el planeta, bibliografía y controles +/-; no hay navegador de unidades editoriales.
- `src/data/gamification.ts` mezcla rangos y logros globales; los logros actuales entregan apodos y no tienen inventario tipado de marcos, fondos, insignias o efectos.
- `src/screens/QuizzesScreen.tsx` contiene un banco pequeño y estático de preguntas de varias obras; no existe un catálogo de tests por obra/sección ni metadatos de procedencia y spoiler por pregunta.
- `package.json` no declara todavía scripts de test ni una suite de pruebas automatizadas.

## Principios no negociables

1. Una afirmación canónica es la unidad mínima que puede bloquearse/desbloquearse.
2. La UI no recibe contenido bloqueado para ocultarlo después: los servicios/selectores filtran antes de devolver datos.
3. Buscar, autocompletar, relaciones, mapas, cronologías, tests, notificaciones y recompensas deben aplicar el mismo motor de spoilers.
4. El orden de publicación, el orden de lectura recomendado y la cronología interna son campos distintos.
5. No inferir que marcar una sección posterior como leída marca automáticamente las anteriores.
6. Las secciones y sus IDs no dependen de la paginación de una edición. Las referencias de página sí deben identificar edición/formato.
7. No inventar datos para completar fichas. Diferenciar confirmado, inferencia, discutido y desconocido.
8. La IA solo trabaja sobre contenido validado de Atlas; nunca es autoridad canónica por sí misma.
9. Mantener compatibilidad con los datos actuales y migrar AsyncStorage sin pérdida silenciosa.
10. No introducir rediseño visual general en esta etapa; primero contratos de datos, comportamiento y cobertura.

## Contrato de datos propuesto

### Catálogo editorial

`Work`
- `id`: ID estable (conservar IDs legados).
- `planetId`, `seriesId`, `title`, `workType` (novela, novela corta, relato, material complementario).
- `publicationOrder`, `recommendedReadingOrder`; nunca reutilizar un único campo para ambos.
- `editionIds` o metadatos de edición cuando cambie la estructura de secciones.

`ReadingUnit`
- `id`: estable y único, p. ej. `twok:prologue`, `twok:chapter:001`, `twok:interlude:001`, `twok:epilogue`.
- `workId`, `ordinal`, `kind` (prologue, chapter, interlude, epilogue, appendix, other), `chapterNumber?`, `label`, `canonicalOrder`.
- `editionVariant?` cuando la división difiera entre ediciones.
- No almacenar el total de capítulos como única representación del libro.

### Enciclopedia normalizada

`Entity`
- `id`, `planetId`, `type` (character, location, species, flora, culture, phenomenon, magicSystem, object, event, concept), `canonicalName`, `aliases`, `relatedEntityIds`.

`Claim`
- `id`, `entityId`, `sectionKey`, `text` (redacción original), `claimType`, `spoilerGate`, `sourceRefs`, `editorialStatus`, `confidence`, `reviewedAt`.
- Una ficha se compone de muchas afirmaciones; no guardar una biografía completa como bloque indivisible.
- Las relaciones entre entidades también son afirmaciones con su propio gate.

`SpoilerGate`
- `allOf: ReadingRequirement[]` y opcionalmente `anyOf: ReadingRequirement[]`.
- Cada requisito identifica `workId` y `readingUnitId`; puede exigir finalización explícita de esa unidad.
- Los datos posteriores de una misma ficha se modelan como nuevas afirmaciones con nuevos gates.
- Si se introducen dependencias entre obras, deben declararse explícitamente; nunca derivarlas solo del orden cronológico ficticio.

`SourceReference`
- `id`, `sourceType` (novel, official_author, official_publisher, official_reference), `workId?`, `readingUnitId?`, `editionId?`, `locator?` (capítulo/sección/página si procede), `notes`.
- No copiar pasajes extensos. Guardar localizador y resumen original.

Estados editoriales:
- `confirmed`: respaldado directamente por fuente canónica.
- `inference`: interpretación razonable, etiquetada como tal.
- `disputed`: fuentes o interpretaciones en tensión.
- `unknown`: no hay información suficiente.
- `draft` / `reviewed` / `published` como estado de flujo editorial separado de la confianza.

### Progreso de lectura

`ReadingProgress`
- `userId` (cuando exista cuenta/sincronización), `workId`, `completedUnitIds[]`, `currentUnitId?`, `updatedAt`, `readingSessions[]?`.
- Guardar las unidades completadas explícitamente; no rellenar automáticamente huecos al marcar una unidad avanzada.
- El selector de desbloqueo evalúa los requisitos contra `completedUnitIds`.
- Para importación del progreso legado, convertir el capítulo actual en una frontera de lectura provisional solo después de confirmar la semántica del dato antiguo. No marcar prólogos/interludios/epílogos como leídos por suposición.
- Las relecturas y el historial no deben borrar logros ni inventario.

### Tests y logros (contratos preparados, implementación posterior)

`QuizQuestion`: `id`, `workId`, `readingUnitIds`, `topic`, `difficulty`, `prompt`, `options`, `correctOptionId`, `explanation`, `sourceRefs`, `spoilerGate`, `reviewStatus`.

`AchievementDefinition`: `id`, `criteria`, `hiddenUntilUnlocked`, `rewardIds[]`, `spoilerGate?`.

`CosmeticReward`: `id`, `type` (frame, title, background, badge, effect), `assetKey`, `rarity?`, `unlockCriteria`.

## Backlog ejecutable

### R0 — Auditoría y contratos (bloqueante)
- [ ] Cerrar inventario exhaustivo automatizado de navegación, catálogos, componentes, persistencia y usos de `totalCapitulos`, `desbloqueoLibroId`, `librosLeidos` y `capituloActualPorLibro` (barrido manual principal documentado en R0).
- [ ] Identificar todos los consumidores del modelo legado antes de cambiar interfaces.
- [ ] Confirmar la lista y el orden editorial de las obras de Roshar, incluidas las novelas cortas y el alcance de material complementario.
- [ ] Definir IDs estables para cada unidad; no inventar números de capítulo ni títulos.
- [x] Documentar política conservadora: mantener progreso legado, no inferir unidades completadas y no desbloquear con valores demo; implementación versionada pendiente.
- [x] Añadir script `npm test` y pruebas automatizadas de contratos de catálogo y motor de spoilers (ejecución CI pendiente).

**Aceptación:** inventario de consumidores completo; ningún ID legado se rompe; catálogo de obras revisado; migración especificada antes de implementarse.

### R1 — Catálogo editorial de Roshar
- [ ] Crear `src/data/roshar/catalog/works.ts`.
- [ ] Crear `src/data/roshar/catalog/readingUnits.ts` con prólogos, capítulos, interludios, epílogos y secciones especiales.
- [ ] Guardar por separado orden de publicación, recomendado y cronología.
- [ ] Incorporar variantes de edición solo cuando haya diferencias verificadas.
- [ ] Crear validador de IDs duplicados, ordinales repetidos, huecos no explicados y referencias a unidades inexistentes.

**Aceptación:** cada obra del alcance tiene estructura editorial revisada; cada unidad tiene ID estable; ninguna referencia apunta a un ID inexistente.

### R2 — Motor de spoilers
- [ ] Implementar tipos de requisitos y evaluación pura, sin dependencias de React.
- [ ] Crear selectores `getVisibleClaims`, `getVisibleEntity`, `getVisibleRelations` y `getVisibleSearchResults`.
- [ ] Aplicar filtrado antes de renderizar o indexar nombres y descripciones bloqueadas.
- [ ] Tratar cualquier error, requisito desconocido o dato sin gate como no publicable en modo estricto.
- [ ] Añadir casos de lectura no lineal, novelas cortas, relectura y dependencias entre obras.
- [ ] Añadir pruebas de regresión para búsqueda, tests y relaciones.

**Aceptación:** ningún dato bloqueado puede recuperarse mediante ninguna API/selectora pública; cobertura de pruebas para gates positivos, negativos, compuestos y datos malformados.

### R3 — Progreso capítulo por capítulo
- [ ] Sustituir la representación única de capítulo por IDs de unidades completadas.
- [ ] Añadir navegación de secciones y selección individual.
- [ ] Mantener el último punto de lectura por obra.
- [ ] Añadir historial/relectura sin borrar logros.
- [ ] Implementar migración versionada desde `@atlas-cosmere/state-v1`.
- [ ] Validar integridad y recuperación ante JSON corrupto o almacenamiento no disponible.

**Aceptación:** cada sección se marca individualmente; marcar una sección posterior no marca las anteriores; la actualización conserva el progreso válido previo.

### R4 — Modelo de enciclopedia y contenido Roshar
- [ ] Crear entidades normalizadas y afirmaciones atómicas.
- [ ] Crear referencias editoriales y flujo de revisión.
- [ ] Migrar gradualmente datos actuales de planeta sin copiar afirmaciones con gates demasiado amplios.
- [ ] Cubrir geografía, regiones, asentamientos, personajes, apariciones, relaciones, culturas, flora, fauna, clima, fenómenos, sistemas mágicos, objetos, historia y cosmología.
- [ ] Registrar explícitamente lagunas de conocimiento en lugar de completar con especulación.
- [ ] Revisar cada afirmación contra su fuente y punto de revelación.

**Aceptación:** todas las categorías del alcance tienen estructura y cobertura editorial documentada; cada afirmación publicada tiene referencia y gate; inferencias y desconocidos están etiquetados.

### R5 — Herramientas de exploración
- [ ] Atlas de lugares y regiones.
- [ ] Bestiario y herbario.
- [ ] Clima y fenómenos naturales.
- [ ] Árbol de Investidura.
- [ ] Cronología filtrada por progreso.
- [ ] Grafo de personajes/relaciones.
- [ ] Glosario y búsqueda avanzada sin filtraciones de spoilers.

**Aceptación:** todas las herramientas consumen los selectores protegidos del motor; no implementan lógica de spoiler independiente.

### R6 — Tests
- [ ] Banco de preguntas revisadas por obra, rango de lectura y temática.
- [ ] Explicación y referencia por respuesta.
- [ ] Evaluación y persistencia de resultados.
- [ ] Backend para generación IA; no exponer claves privadas en el cliente.
- [ ] Validación de salida, referencias y spoiler gate antes de entregar preguntas.
- [ ] Rechazar preguntas sin evidencia suficiente.

**Aceptación:** cada pregunta publicada tiene fuente, gate y respuesta revisada; tests generados no pueden superar el progreso del usuario.

### R7 — Logros y recompensas
- [ ] Separar definiciones de logros del estado desbloqueado del usuario.
- [ ] Añadir criterios verificables y logros ocultos protegidos por spoiler gate.
- [ ] Crear inventario cosmético tipado (marcos, apodos, fondos, insignias, efectos).
- [ ] Evitar recompensas duplicadas y explotación por repetición.
- [ ] Migrar apodos actuales a inventario compatible.

**Aceptación:** recompensas persistentes, criterios reproducibles y ningún logro revela contenido posterior.

### R8 — Auditoría integral
- [ ] Pruebas de motor, catálogo, migración y selectores.
- [ ] Pruebas manuales de lectura no lineal y relectura.
- [ ] TypeScript y exportación Android.
- [ ] Validación de rendimiento de búsqueda y catálogos.
- [ ] Revisión de accesibilidad y estados vacíos.
- [ ] Revisión editorial final de cobertura y referencias.

**Aceptación:** CI verde en el commit actual, sin regresiones de progreso ni filtraciones de spoilers conocidas; incidencias restantes documentadas.

## Orden de implementación recomendado

R0 → R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8.

No empezar la carga masiva de contenido ni la generación IA antes de que R1–R3 estén implementadas y probadas.

## Primeras tareas concretas

1. Completar inventario de consumidores del modelo actual en `App.tsx`, `CosmereContext.tsx`, `cosmereUniverse.ts`, `InvestitureWheel.tsx`, `QuizzesScreen.tsx`, `CommunityScreen.tsx`, `ProfileScreen.tsx` y `ToolsScreen.tsx`.
2. Diseñar los tipos TypeScript definitivos en un módulo aislado, sin migrar todavía las pantallas.
3. Crear el catálogo editorial de Roshar y un validador que detecte unidades ausentes o duplicadas.
4. Implementar el motor de spoilers puro y sus pruebas antes de conectar UI.

## Fuera de alcance de esta etapa

- Rediseño visual general.
- Comunidad y cambios de Hoid IA.
- Publicación o merge a `main`.
- Afirmar cobertura canónica completa sin revisión fuente por fuente.

## Registro de implementación

### Iteración 1 — R0 inicial y contratos base

- [x] Inspección inicial de `CosmereContext`, catálogo planetario, navegación principal, rueda de Investidura, tests, herramientas, comunidad, perfil y gamificación.
- [x] Documentar consumidores principales y riesgos de migración en `docs/roshar/R0_AUDIT.md`.
- [x] Añadir contratos de dominio en `src/data/roshar/model.ts`.
- [x] Añadir adaptador del catálogo actual de obras de Roshar en `src/data/roshar/catalog/works.ts`, conservando los IDs legados.
- [ ] Completar búsqueda exhaustiva de referencias y validar los contratos en CI.
- [ ] Verificar el orden editorial y crear unidades de lectura a partir de índices de ediciones concretas.

**Resultado:** se ha añadido la primera capa de tipos y el adaptador de obras. No se ha cambiado aún la persistencia ni el comportamiento de desbloqueo; tampoco se ha declarado completa la auditoría R0.

### Iteración 2 — primer selector de spoilers

- [x] Añadir `src/data/roshar/spoilers.ts` con evaluación pura de gates `allOf` / `anyOf`.
- [x] Fallar de forma cerrada ante gates vacíos, requisitos malformados o unidades que no coinciden con la obra declarada.
- [x] Exponer un selector que solo devuelve afirmaciones publicadas, con referencias y gate satisfecho.
- [ ] Añadir suite ejecutable de pruebas unitarias y casos de regresión.
- [ ] Conectar los selectores con las pantallas; no hacerlo hasta disponer de catálogo de unidades y progreso nuevo.

**Resultado:** existe el primer núcleo de evaluación, todavía no está conectado a la UI ni puede desbloquear contenido porque aún no se ha cargado el catálogo de unidades editoriales.

## Iteración 3 — catálogo editorial y fuentes (2026-11-04)

- [x] Añadida documentación de jerarquía de fuentes y política de edición en `docs/roshar/EDITORIAL_SOURCES.md`.
- [x] Incluidos `Elsecaller` y `King Lopen: The First of Alethkar` como relatos oficiales separados (IDs nuevos), sin inventar unidades ni recuentos.
- [x] Corregida la lectura recomendada local de Roshar: se deja de heredar el campo legado global (valores 5, 7, 8...) y se usa la numeración oficial de la serie (1, 2, 2.5, 3, 3.5, 4, 5); los relatos Story Deck se sitúan como 2.6 y 2.7.
- [x] Documentado que Horneater no se añade como obra publicada/unidades hasta que exista confirmación editorial de publicación.
- [x] Confirmar el alcance lingüístico inicial en español y registrar ISBN españoles de referencia para las seis primeras obras con edición verificada; inglés queda para una fase posterior. Los títulos sin ISBN español independiente verificado permanecen pendientes.
- [ ] Publicar un inventario completo de unidades con variante de edición y referencias de localización.

### Estado de CI de las pruebas

La primera ejecución de `npm test` detectó correctamente un fixture defectuoso en la prueba de IDs duplicados (el caso no contenía realmente un ID repetido). Se corrigió el fixture; la nueva ejecución debe confirmarse antes de marcar las pruebas como verdes. La ejecución anterior no se considera validación satisfactoria.

### Iteración 4 — referencia editorial española (2026-11-04)

- [x] Confirmado por el usuario: el primer lanzamiento de Roshar se trabajará en español; el inglés queda para una fase posterior.
- [x] Registrados ISBN de cotejo inicial para El camino de los reyes, Palabras radiantes, Danzante del Filo, Juramentada, Esquirla del Amanecer y El ritmo de la guerra en `docs/roshar/EDITORIAL_SOURCES.md`.
- [x] Documentadas variantes de edición y la regla de separar IDs semánticos de lectura de localizadores físicos/paginación.
- [ ] Verificar ISBN y estructura española de Viento y verdad.
- [ ] Verificar si Elsecaller y King Lopen disponen de edición española independiente; mantenerlos en catálogo oficial, pero sin unidades hasta confirmar.
- [ ] Cotejar el índice completo de El camino de los reyes contra el ejemplar de referencia (ISBN `9788466647946`) y registrar todas las secciones en el catálogo.
- [ ] Extender el mismo procedimiento al resto de obras.

**Validación CI:** el workflow `41744870889` terminó correctamente: tests de contratos de Roshar, TypeScript y exportación Android completados con éxito. Resultado válido para el SHA `8862ee4244cc19eb2b36763ca2f78f6ee6543757`; no implica que el catálogo editorial esté completo.

### Iteración 5 — cotejo documental de El camino de los reyes (2026-11-04)

- [x] Confirmada la ficha bibliográfica de Ediciones B para el ISBN `9788466647946`: título, autor, publicación en 2012, formato e ISBN.
- [x] Corroborados en Google Books la editorial, año, traductor Rafael Marín Trechera, ISBN y extensión bibliográfica de 1196 páginas.
- [x] Localizado un índice secundario en Coppermind ES como pista de inventario.
- [x] Localizado el índice de Open Library para una edición inglesa; se registra solo como lista de comprobación, no como sustituto del índice español.
- [ ] Obtener y cotejar el índice completo del ejemplar español ISBN `9788466647946`.
- [ ] Solo después del cotejo, crear unidades españolas con IDs semánticos y localizadores de edición.
- [ ] Ejecutar validador de catálogo y pruebas de integridad para `twok`.

**Resultado:** la edición española está identificada, pero el índice español completo no está verificado. No se ha creado un catálogo de unidades ficticio ni se ha alterado el comportamiento de la aplicación.

---
