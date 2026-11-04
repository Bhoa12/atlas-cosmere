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
- `package.json` declara `npm test`; existen pruebas automatizadas de contratos de Roshar, progreso, almacenamiento y motor de spoilers. La última ejecución verde confirmada corresponde a un SHA anterior, no al commit actual.

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
- [x] Crear `src/data/roshar/catalog/works.ts`.
- [x] Crear `src/data/roshar/catalog/readingUnits.ts` y los inventarios NCX de las siete obras aportadas, con prólogos, capítulos, interludios, epílogos y secciones especiales.
- [ ] Guardar por separado orden de publicación, recomendado y cronología.
- [x] Registrar variantes digitales EPUB verificadas; las variantes impresas siguen separadas y no se infiere equivalencia.
- [x] Crear validadores de IDs, ordinales, referencias, variantes editoriales y secuencias de capítulos numerados; el cotejo de etiquetas XHTML y diferencias entre ediciones sigue pendiente.

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


### Iteración 6 — auditoría de EPUB aportados por el usuario (2026-11-04)

- [x] Inspeccionados metadatos OPF y tabla de contenidos NCX del EPUB recopilatorio de las cinco novelas principales.
- [x] Inspeccionado el EPUB de Danzante del Filo.
- [x] Inspeccionado el EPUB de Esquirla del amanecer.
- [x] Registrados traductores declarados, estructura y recuentos de índice en `docs/roshar/EPUB_TOC_AUDIT.md`.
- [x] Identificadas anomalías de origen: dos rótulos numéricos en interludios de Viento y verdad y dos entradas de prólogo en Juramentada. No se normalizan sin cotejo.
- [x] Confirmado por el usuario que no dispone de Elsecaller ni King Lopen; se mantienen sin unidades y no bloquean las siete obras disponibles.
- [ ] Generar `src/data/roshar/catalog/readingUnits.ts` para las siete obras, conservando la variante digital de origen separada de ISBN impresos.
- [ ] Añadir tipos/validaciones para partes, días, bloques de interludios y material complementario.
- [ ] Resolver con evidencia las anomalías de índice antes de publicar el catálogo definitivo.
- [ ] Añadir pruebas de cobertura por obra y validación de IDs/ordinales.
- [ ] Conectar el catálogo al progreso y motor de spoilers solo después de superar esas validaciones.

**Resultado:** ya existe una fuente de índice en español para las siete obras aportadas. Los EPUB permiten construir un inventario digital de referencia, pero no prueban equivalencia exacta con las ediciones impresas identificadas previamente. No se ha creado todavía el catálogo de unidades ni se ha conectado a la aplicación.


### Iteración 7 — contrato de unidades y variantes EPUB (2026-11-04)

- [x] Ampliado `ReadingUnitKind` para distinguir preludios, prólogos, capítulos, interludios, epílogos, postludios, Ars Arcanum, agradecimientos y notas finales.
- [x] Introducidos contenedores editoriales `ReadingSection` para partes, días y bloques de interludios; no son unidades completables.
- [x] Añadidos localizadores de origen por unidad (`editionVariantId` + ruta NCX), sin paginación ni ISBN inferidos.
- [x] Registradas siete variantes de obra/EPUB a partir de los tres archivos aportados, con procedencia explícita y `isbn: null`.
- [x] Ampliada la validación para comprobar sección, jerarquía y correspondencia de la variante editorial con la obra.
- [x] Añadidas pruebas de contrato para secciones y localizadores específicos de edición.
- [ ] Incorporar los 7 índices NCX al catálogo ejecutable de unidades, preservando el árbol de partes/días y los bloques de interludios.
- [ ] Resolver antes de publicar las anomalías documentadas de Viento y verdad y Juramentada.
- [ ] Añadir validación de cobertura esperada por obra y auditoría de IDs semánticos.
- [ ] Ejecutar y confirmar CI en el último SHA tras estos cambios.

**Resultado:** queda definida la representación técnica necesaria para importar las tablas de contenido sin confundir contenedores con unidades de progreso ni mezclar EPUB con ediciones impresas. Todavía no se han cargado unidades narrativas reales ni se ha conectado el catálogo al progreso o al motor de spoilers.


### Iteración 8 — importación completa de índices NCX (2026-11-04)

- [x] Importadas las entradas de lectura de las siete obras disponibles a partir de los tres NCX aportados.
- [x] Creados módulos de inventario por obra bajo `src/data/roshar/catalog/readingUnits/`.
- [x] Añadido el agregador `src/data/roshar/catalog/readingUnits.ts`, que genera IDs semánticos y ordinales de progreso por obra y adjunta la variante EPUB y su ruta NCX.
- [x] Representadas partes, días y bloques de interludios como contenedores estructurales que no se marcan como completados.
- [x] Conservadas las dos entradas numéricas anómalas de Viento y verdad como `other`, sin número de capítulo; conservados los dos prólogos de Juramentada.
- [x] Añadidas pruebas de cobertura de los 589 capítulos numerados, 684 unidades importadas y 54 secciones estructurales, además de IDs, localizadores y procedencia editorial.
- [x] Documentados los recuentos y las reglas de importación en `EPUB_TOC_AUDIT.md`.
- [ ] Validar CI en el último commit de esta iteración.
- [x] Verificar que las 684 rutas relativas NCX resuelven a un XHTML existente bajo la raíz `OEBPS/` de los EPUB; 0 destinos ausentes. El cotejo textual de encabezados XHTML frente a rótulos NCX queda pendiente.
- [ ] Confirmar la política de producto para marcar agradecimientos, Ars Arcanum y notas finales como leídos; por ahora se conservan como unidades explícitas, separadas de capítulos.
- [ ] Implementar migración de progreso legado y navegación capítulo por capítulo solo después de cerrar R0 y aprobar el catálogo.

**Resultado:** el catálogo ya contiene una transcripción estructural completa de los índices de las siete obras aportadas. No está conectado todavía a persistencia, pantallas ni motor de spoilers. La fuente digital sigue separada de ediciones impresas y no se declara equivalencia editorial.


### Iteración 9 — operaciones puras de progreso explícito (2026-11-04)

- [x] Añadido `src/data/roshar/progress.ts` con creación de progreso vacío, selección del punto actual, finalización explícita de una unidad, saneamiento y validación.
- [x] Separada la acción «abrir/seleccionar unidad» de «marcar unidad completada».
- [x] Una unidad posterior completada no marca unidades anteriores ni intermedias.
- [x] El saneador acepta únicamente el esquema granular nuevo; los objetos legados `librosLeidos` / `capituloActualPorLibro` no se convierten en unidades completadas.
- [x] Añadidas pruebas para lectura no lineal, asignaciones entre obras, datos duplicados y entrada legado.
- [ ] Integrar estas operaciones en una capa de almacenamiento versionada y transaccional, con respaldo y recuperación.
- [ ] Añadir pruebas de migración real de AsyncStorage antes de tocar `CosmereContext`.
- [ ] Mantener la UI antigua como compatibilidad hasta que exista una ruta de migración segura y una navegación capítulo por capítulo.

**Resultado:** ya existe la lógica de dominio para el progreso explícito, aislada de React y AsyncStorage. No está conectada a la aplicación y no modifica datos del usuario.


### Iteración 10 — almacenamiento granular versionado aislado (2026-11-04)

- [x] Añadido `src/data/roshar/progressStorage.ts` con clave independiente `@atlas-cosmere/reading-progress-v2`.
- [x] El lector acepta exclusivamente el esquema v2 y sanea IDs/unidades antes de devolverlos.
- [x] JSON corrupto, versión desconocida y almacenamiento no disponible devuelven progreso vacío de forma controlada.
- [x] La capa nunca lee, sobrescribe ni elimina `@atlas-cosmere/state-v1`.
- [x] El guardado escribe solo en la clave v2 y devuelve un resultado explícito si falla.
- [x] Añadidas pruebas con almacenamiento simulado para ausencia de datos, esquema inválido, JSON corrupto, errores de lectura/escritura y conservación de state-v1.
- [ ] Integrar el adaptador en `CosmereContext` con hidratación y guardado coordinados; no activar hasta definir rollback y transición de UX.
- [ ] Añadir respaldo exportable y pruebas de recuperación ante interrupción entre lectura y escritura.

**Resultado:** la persistencia granular ya tiene una vía técnica independiente y no destructiva. Sigue desconectada del contexto React; el progreso legado permanece intacto.


### Iteración 11 — política de finalización narrativa (2026-11-04)

- [x] Definida la diferencia entre unidades narrativas obligatorias y material complementario opcional en `docs/roshar/READING_COMPLETION_POLICY.md`.
- [x] Añadida la función pura `isRequiredForNarrativeCompletion` en `src/data/roshar/progress.ts`.
- [x] Añadidas pruebas: capítulos y unidades narrativas siguen siendo requeridos; Ars Arcanum, agradecimientos, apéndices y material editorial posterior no bloquean la finalización narrativa.\n- [x] Añadido `isNarrativeWorkComplete`, que calcula la finalización a partir de todas las unidades narrativas requeridas y los IDs completados explícitamente; obras desconocidas o sin unidades no aparecen como terminadas.
- [x] Las unidades `other` permanecen requeridas hasta revisión editorial, evitando clasificar silenciosamente anomalías como material opcional.
- [ ] Conectar el cálculo de finalización narrativa al navegador de lectura y a los logros, sin cambiar todavía el estado legado.
- [ ] Ejecutar CI completo sobre el commit resultante.

**Resultado:** existe una regla técnica explícita y testeable. No cambia aún la UI ni la persistencia; el progreso v1 continúa intacto.


### Iteración 12 — proyecciones seguras de enciclopedia y búsqueda (2026-11-04)

- [x] Añadido `selectVisibleClaimsForEntity`: solo devuelve afirmaciones publicadas, con fuente y gate satisfecho para la entidad solicitada.
- [x] Añadido `selectVisibleClaimsForSearch`: filtra primero por progreso y estado editorial, y solo después busca en el texto visible.
- [x] Añadidas pruebas que verifican que una afirmación bloqueada no aparece en la ficha parcial ni produce resultados de búsqueda.
- [x] Documentada la restricción de que nombres/alias de entidad no deben indexarse sin su propio gate editorial.
- [ ] Conectar estas proyecciones a las pantallas, mapas, relaciones y autocompletado cuando existan datos atómicos revisados; no se deben indexar los datos legacy directamente.
- [ ] Ejecutar CI completo sobre el SHA final.

**Resultado:** las proyecciones puras para claims por entidad y búsqueda están disponibles y probadas por contrato; todavía no hay contenido de enciclopedia publicado ni consumidores UI conectados.


### Iteración 13 — integración controlada del progreso granular (2026-11-04)

- [x] Integrado el esquema v2 de Roshar en `CosmereContext` sin modificar ni migrar `@atlas-cosmere/state-v1`.
- [x] Expuestos `readingProgress`, `setUnidadLecturaActual` y `completarUnidadLectura` como operaciones explícitas por unidad.
- [x] La hidratación espera tanto el estado legado como el progreso granular antes de mostrar la aplicación.
- [x] Si la lectura v2 devuelve `invalid` o `unavailable`, el contexto conserva el estado vacío en memoria pero no sobrescribe automáticamente el almacenamiento problemático.
- [x] Los contadores y banderas legados siguen funcionando sin conversión automática a capítulos completados.
- [ ] Añadir una pantalla de recuperación/exportación para datos v2 inválidos o almacenamiento no disponible.
- [ ] Conectar la navegación de lectura de la UI a estas operaciones y retirar gradualmente los controles +/- para las obras con catálogo granular.

**Resultado:** el progreso granular ya está disponible para la aplicación, pero convive de forma aislada con el estado v1. No se ha reinterpretado el historial antiguo como progreso real.


### Iteración 15 — progreso con consecuencias y base de recompensas (2026-11-04)

- [x] Definida una primera colección declarativa de hitos de lectura de Roshar con recompensas cosméticas.
- [x] Las condiciones de los hitos se basan exclusivamente en progreso granular explícito y finalización narrativa calculada.
- [x] Añadido un selector de recuento de unidades completadas, sin usar contadores legados.
- [x] Añadidas pruebas para asegurar que los recuentos desconocidos devuelven cero y no infieren lectura.
- [ ] Persistir logros desbloqueados y el inventario de recompensas cosméticas.
- [ ] Crear marcos, fondos y apodos visuales en el perfil y permitir equiparlos.
- [ ] Añadir hitos por obra, parte y rachas una vez exista un modelo de sesiones/fechas de lectura.
- [ ] Conectar el progreso granular con el contenido editorial y sus spoiler gates.

**Resultado:** los primeros desbloqueos ya tienen un modelo declarativo seguro, pero todavía no se muestran ni se guardan como inventario del perfil.


### Iteración 16 — proyección segura de la enciclopedia (2026-11-04)

- [x] Añadido un selector de entidades visible que omite por completo entidades sin ninguna afirmación publicada y desbloqueada.
- [x] Las fichas pueden revelar información parcialmente: cada afirmación mantiene su propio spoiler gate.
- [x] Añadada validación editorial para entidades, fuentes, unidades de lectura y coherencia obra/unidad.
- [x] Añadidas pruebas para impedir que una entidad completamente bloqueada aparezca en la proyección pública.
- [ ] Crear los primeros datasets editoriales reales de Roshar con referencias verificadas.
- [ ] Diseñar la pantalla de enciclopedia para consumir estas proyecciones sin indexar nombres o alias bloqueados.
- [ ] Añadir revisión editorial por lote antes de publicar afirmaciones en la aplicación.

**Resultado:** la infraestructura ya permite cargar contenido real de forma incremental y mostrar únicamente las afirmaciones cuyo punto de lectura se ha alcanzado.


### Iteración 17 — pipeline editorial antes de publicar contenido (2026-11-04)

- [x] Creado un registro de procedencia para los EPUB españoles aportados y auditados en el repositorio.
- [x] Creado un dataset público conservador que no inventa personajes, lugares o hechos a partir de una tabla de contenidos.
- [x] Formalizada la política: las afirmaciones publicadas requieren revisión, fuente y un spoiler gate explícito.
- [x] Añadidas pruebas para asegurar que el dataset inicial no contiene hechos canónicos sin revisar.
- [ ] Recuperar/leer los pasajes de los archivos fuente necesarios para crear afirmaciones editoriales reales.
- [ ] Crear el primer lote de entidades y afirmaciones revisadas, empezando por El camino de los reyes.
- [ ] Añadir una herramienta de revisión para comprobar fuente, unidad de desbloqueo y estado editorial antes de publicar.

**Resultado:** Atlas ya tiene una ruta segura de ingestión editorial. El siguiente cuello de botella no es técnico: es revisar el texto fuente y registrar afirmaciones verificables sin inventar contenido.


### Iteración 18 — control de publicación editorial (2026-11-04)

- [x] Endurecida la validación: una afirmación publicada debe tener fecha de revisión.
- [x] Las afirmaciones publicadas basadas en una novela requieren una fuente con unidad de lectura y locator exactos.
- [x] Añadido un inspector de lotes editoriales para conocer si un conjunto de contenido es publicable.
- [x] Añadidas pruebas que bloquean contenido publicado sin revisión, fuente exacta o spoiler gate.
- [ ] Recuperar el texto fuente de las obras aportadas; la búsqueda actual de archivos no encontró material indexado disponible en la conversación o biblioteca.
- [ ] Ingerir el primer lote real de El camino de los reyes una vez el texto fuente esté accesible.
- [ ] Automatizar la validación del dataset editorial dentro de CI cuando existan lotes publicados.

**Resultado:** el repositorio puede preparar y validar contenido, pero se niega explícitamente a publicar hechos de ficción sin una revisión trazable hasta una unidad concreta del texto fuente.


### Iteración 19 — corrección de CI y seguimiento de lectura (2026-11-04)

- [x] Corregido el fallo de las pruebas de enciclopedia introducido al añadir la validación editorial estricta.
- [x] Añadido un resumen determinista del progreso por obra: unidades completadas, unidades narrativas requeridas, porcentaje y siguiente unidad.
- [x] La interfaz de lectura muestra ahora el porcentaje calculado exclusivamente a partir de unidades completadas explícitamente.
- [x] Añadida una prueba para asegurar que el material suplementario no infla el porcentaje narrativo.
- [ ] Verificar una ejecución completa de CI sobre el commit final de esta iteración.
- [ ] Ingerir contenido editorial real desde los EPUB con locators de pasaje exactos.

**Resultado:** el seguimiento granular ya dispone de una métrica única y reproducible para la UI y futuros logros; el porcentaje no depende de contadores heredados ni de inferencias de capítulos.


### Iteración 19 — frontera explícita de lectura (2026-11-04)

- [x] Añadida una proyección de panel de lectura basada exclusivamente en unidades completadas explícitamente.
- [x] Añadido cálculo de frontera consecutiva: completar una unidad posterior no rellena huecos anteriores.
- [x] El panel distingue el porcentaje narrativo de la siguiente unidad narrativa pendiente; el material suplementario no bloquea la frontera.
- [x] Añadidas pruebas para progreso no lineal y para ignorar material suplementario en la continuidad narrativa.
- [ ] Conectar la proyección con las pantallas de React existentes sin reintroducir el contador legado.
- [ ] Recuperar el texto fuente para iniciar el primer lote editorial real de afirmaciones verificadas.

**Resultado:** la capa de dominio ya puede mostrar una posición de lectura honesta incluso cuando el usuario lee de forma no lineal, sin conceder progreso ni desbloqueos por inferencia.


### Iteración 20 — evaluación determinista de logros de lectura (2026-11-04)

- [x] Añadido un evaluador puro de logros de lectura basado exclusivamente en unidades completadas explícitamente.
- [x] La finalización narrativa respeta la política editorial: el material suplementario no bloquea un logro de historia completada.
- [x] La proyección de recompensas deduplica IDs y es idempotente; reevaluar el progreso no puede crear recompensas duplicadas.
- [x] Añadidas pruebas para progreso con huecos, finalización narrativa y deduplicación.
- [ ] Separar el estado persistente de logros desbloqueados del catálogo global de definiciones.
- [ ] Añadir spoiler gates a logros ocultos antes de exponer títulos o descripciones que puedan revelar contenido.
- [ ] Integrar la proyección con el contexto/UI y la persistencia versionada.

**Resultado:** Roshar ya dispone de una base reproducible para calcular logros de lectura sin confiar en contadores heredados ni conceder recompensas por repetición.


### Iteración 20 — reparación de CI y verificación de contratos (2026-11-04)

- [x] Revisado el fallo de CI del commit de logros: los 48 contratos de Roshar pasaban, pero TypeScript fallaba por una ruta de importación incorrecta.
- [x] Corregida la importación de gamificación en la capa de logros de Roshar.
- [x] Conservado el cálculo de logros basado exclusivamente en progreso granular explícito.
- [ ] Confirmar la ejecución completa de CI sobre el commit de corrección.

**Resultado:** el fallo detectado era de compilación, no de comportamiento del dominio; la siguiente ejecución valida el arreglo sobre la rama de trabajo.


### Iteración 20 — logros ocultos seguros frente a spoilers (2026-11-04)

- [x] Añadida una proyección de presentación para logros que aplica el mismo motor de spoiler gates que la enciclopedia.
- [x] Los logros ocultos no revelan título, descripción ni recompensa antes de desbloquearse o alcanzar su gate editorial.
- [x] Las recompensas solo se incluyen en la proyección visible cuando el logro está realmente desbloqueado.
- [x] Añadidas pruebas para títulos bloqueados y revelación tras completar la unidad requerida.
- [ ] Sustituir el logro de ejemplo por hitos editoriales reales cuando el texto fuente sea revisado.

**Resultado:** la gamificación ya no constituye una vía alternativa para filtrar spoilers a través de nombres o descripciones de logros.


### Iteración 21 — persistencia monotónica de logros (2026-11-04)

- [x] Separado el estado persistente de logros y recompensas de sus definiciones globales.
- [x] Los desbloqueos son monotónicos: una reevaluación o corrección posterior no revoca una recompensa ya concedida.
- [x] Deduplicadas recompensas compartidas entre varios logros.
- [x] Añadido saneamiento del estado persistido para descartar valores corruptos o duplicados.
- [x] Añadidas pruebas de persistencia, idempotencia y recuperación de datos malformados.
- [ ] Conectar este estado al almacenamiento real de la aplicación y a una migración versionada.
- [ ] Revisar el catálogo de recompensas visuales y eliminar textos globales que puedan filtrar spoilers.

**Resultado:** la evaluación de logros ya puede integrarse con persistencia sin perder recompensas legítimas durante relecturas o correcciones de progreso.


### Iteración 21 — almacenamiento versionado de logros (2026-11-04)

- [x] Añadido adaptador de persistencia específico para el estado de logros de Roshar, separado del progreso de lectura.
- [x] La clave está versionada y no consume ni sobrescribe claves de progreso existentes.
- [x] Lecturas corruptas, versiones incompatibles y almacenamiento no disponible devuelven un estado seguro y un diagnóstico explícito.
- [x] Las escrituras saneadas no mutan el estado en memoria del llamador cuando fallan.
- [x] Añadidas pruebas de round-trip, JSON corrupto, versión incompatible y fallos del almacenamiento.
- [ ] Conectar el adaptador a la capa de estado de la aplicación y definir una migración explícita para cualquier estado legado de logros.
- [ ] Ejecutar CI completo sobre el commit final de la iteración y corregir cualquier regresión.

**Resultado:** progreso de lectura y recompensas ya disponen de fronteras de persistencia independientes y versionadas; la integración con el estado de React sigue siendo el siguiente paso para evitar cambios de UI sin una migración controlada.


### Iteración 22 — integración segura de logros con el estado de la aplicación (2026-11-04)

- [x] Integrado el estado versionado de logros de Roshar en `CosmereContext`, separado del estado legado y del progreso granular.
- [x] La hidratación espera el progreso y los logros antes de exponer la aplicación, evitando evaluar recompensas sobre datos parcialmente cargados.
- [x] Los logros se recalculan desde unidades completadas explícitamente y se fusionan de forma monotónica con el inventario persistido.
- [x] Los IDs de logros y recompensas ya concedidos no se revocan por una corrección posterior del progreso.
- [x] Datos inválidos o almacenamiento no disponible permanecen sin sobrescribirse automáticamente durante la hidratación.
- [x] Expuestas al contexto las proyecciones de presentación protegidas contra spoilers y el estado persistente de logros.
- [ ] Conectar la presentación de logros a una pantalla React específica sin mostrar definiciones bloqueadas fuera del selector seguro.
- [ ] Añadir pruebas de integración de hidratación del contexto en un entorno React/AsyncStorage simulado.
- [ ] Confirmar CI completo sobre el SHA final de esta iteración.

**Resultado:** la persistencia de recompensas ya está conectada al flujo real de la aplicación sin migrar ni reinterpretar el estado legado. La siguiente capa debe ser de UI y pruebas de integración, no una nueva lógica de desbloqueo.


### Iteración 23 — pantalla segura de logros de Roshar (2026-11-04)

- [x] Añadida una pantalla React específica para presentar los logros de lectura de Roshar.
- [x] La pantalla consume exclusivamente la proyección filtrada por spoiler gates del contexto; no accede a definiciones globales de logros.
- [x] Los logros ocultos conservan título y descripción anonimizados en la UI.
- [x] Las recompensas solo aparecen cuando el logro ya está desbloqueado.
- [x] Integrada la pantalla en la navegación principal de Atlas.
- [ ] Añadir pruebas de integración de hidratación y presentación con AsyncStorage simulado.
- [ ] Confirmar CI completo sobre el SHA final y corregir cualquier regresión.

**Resultado:** los logros de Roshar ya disponen de una superficie visible en la aplicación sin abrir una nueva vía de filtración de spoilers.


### Iteración 24 — corrección del gate de presentación de logros (2026-11-04)

- [x] Investigado el fallo de CI del commit de la pantalla de logros: 55 de 56 contratos pasaban y fallaba la revelación tras completar el spoiler gate.
- [x] Corregida la proyección para evaluar el gate directamente con `isSpoilerGateSatisfied`, compartiendo el mismo evaluador fail-closed del motor de spoilers.
- [x] Eliminada la reutilización incorrecta del selector editorial de enciclopedia, que exige publicación y referencias de fuente y por tanto ocultaba siempre los metadatos de logros.
- [ ] Confirmar la ejecución completa de CI sobre el commit de corrección.

**Resultado:** los logros ocultos siguen protegidos antes de alcanzar su gate, y los títulos no ocultos pueden revelarse correctamente cuando el progreso explícito satisface el requisito. La publicación editorial de la enciclopedia continúa siendo independiente de la presentación de logros.


### Iteración 25 — coherencia monotónica entre persistencia y presentación de logros (2026-11-04)

- [x] Detectada una discrepancia entre el estado persistente monotónico y la pantalla: un logro concedido podía volver a mostrarse como pendiente tras una corrección posterior del progreso.
- [x] Extendida la proyección de presentación para aceptar IDs de logros ya concedidos y tratarlos como desbloqueados.
- [x] Conectada la pantalla, a través de `CosmereContext`, al inventario persistente de IDs desbloqueados.
- [x] Mantenida la evaluación de spoiler gates: un logro persistido se presenta como concedido, pero el sistema no vuelve a calcular ni duplica recompensas.
- [x] Añadida una prueba de regresión para una corrección posterior del progreso.
- [ ] Confirmar CI completo sobre el SHA final de esta iteración.

**Resultado:** el contrato de desbloqueo monotónico ya es coherente entre almacenamiento, estado de aplicación y presentación, evitando que una recompensa obtenida legítimamente parezca desaparecer de la UI.


### Iteración 26 — verificación final de CI de la coherencia monotónica (2026-11-04)

- [x] Confirmada la ejecución completa de GitHub Actions para el SHA final de la Iteración 25: `67bf87f13183eb8c9b8301bb285020399b5baf29`.
- [x] La ejecución **Atlas Android validation #162** terminó correctamente (`success`) el 2026-11-04.
- [x] Con ello queda validada en CI la corrección que mantiene visible un logro concedido después de una corrección posterior del progreso.
- [ ] Añadir pruebas de integración de hidratación del contexto en un entorno React/AsyncStorage simulado; el repositorio actual no incluye un renderer de pruebas de React, por lo que conviene introducir esa infraestructura de forma deliberada en lugar de simular la UI con pruebas de texto.
- [ ] Ingerir el primer lote editorial real desde los EPUB cuando el texto fuente vuelva a estar accesible a las herramientas de revisión.

**Resultado:** la última regresión de presentación de logros está validada por CI. El siguiente trabajo técnico pendiente es ampliar la cobertura de integración de hidratación sin debilitar los contratos de dominio ya existentes; el siguiente trabajo editorial continúa bloqueado por la ausencia del texto de los EPUB en el entorno de recuperación actual.


### Iteración 27 — revalidación de fuentes EPUB y endurecimiento del catálogo (2026-11-04)

- [x] Recuperados directamente en el entorno de revisión los tres EPUB privados aportados: la recopilación de las cinco novelas principales, *Danzante del Filo* y *Esquirla del amanecer*.
- [x] Reinspeccionadas sus tablas de contenido NCX; las estructuras observadas confirman la disponibilidad de las siete obras para continuar la revisión editorial sin inventar unidades.
- [x] Endurecido `validateRosharReadingCatalog` para detectar localizadores NCX duplicados dentro de una variante editorial, localizadores con espacios no normalizados y referencias de sección que crucen accidentalmente entre obras.
- [x] Mantenida la política de no tratar la mera estructura del índice como evidencia de hechos canónicos: personajes, lugares, fauna, flora, clima y magia siguen requiriendo pasajes y referencias propias.
- [ ] Añadir pruebas de regresión específicas para los tres nuevos invariantes del validador.
- [ ] Iniciar el primer lote editorial real a partir de pasajes revisados del EPUB, con localizador exacto, resumen original y spoiler gate explícito.
- [ ] Confirmar CI completo sobre el SHA final de esta iteración.

**Resultado:** el catálogo estructural queda mejor protegido frente a errores de procedencia y mezcla accidental entre obras. Las fuentes privadas ya están disponibles para desbloquear el siguiente bloque editorial, pero no se publica contenido narrativo hasta que cada afirmación sea revisada y trazable.


### Iteración 28 — pruebas de regresión de procedencia NCX (2026-11-04)

- [x] Extraído el validador del catálogo a una función pura con entrada explícita, conservando el wrapper que valida el catálogo real.
- [x] Añadida una regresión para rechazar localizadores NCX duplicados dentro de la misma variante editorial.
- [x] Añadida una regresión para rechazar espacios no normalizados en localizadores NCX.
- [x] Añadida una regresión para rechazar referencias de sección que crucen entre obras.
- [ ] Confirmar CI completo sobre los commits finales de esta iteración.
- [ ] Empezar el primer lote editorial real únicamente con pasajes accesibles y revisados, sin derivar hechos de la tabla de contenidos.

**Resultado:** los tres invariantes de procedencia añadidos en la Iteración 27 quedan ahora cubiertos por pruebas directas. La validación puede ejercitar catálogos sintéticos sin mutar el dataset real, reduciendo el riesgo de que futuros cambios vuelvan a aceptar errores de mezcla de obras o de localizadores.


### Iteración 29 — orientación de lectura coherente con la finalización narrativa (2026-11-04)

- [x] Añadido un selector explícito para obtener la siguiente unidad narrativa pendiente en orden de catálogo.
- [x] Alineado el campo `nextUnitId` del resumen de seguimiento con la misma política usada para calcular la finalización narrativa.
- [x] El material suplementario sigue siendo registrable, pero ya no desvía la recomendación de “siguiente paso” cuando queda una unidad narrativa pendiente.
- [x] Añadidas regresiones para comprobar que la orientación salta suplementos no requeridos y queda vacía cuando todas las unidades narrativas están completadas.
- [ ] Confirmar CI completo sobre el SHA final de esta iteración.

**Resultado:** el seguimiento granular deja de mezclar dos semánticas distintas: una obra puede conservar suplementos sin leer y, aun así, mostrar correctamente que no queda ninguna unidad narrativa requerida.


### Iteración 30 — corrección de regresión de CI en la guía de lectura (2026-11-04)

- [x] Investigado el fallo del workflow **Atlas Android validation #171** del SHA `34f4f9402b8e37f08efbf2b0705c292cd72685ea`.
- [x] Identificada la causa: una prueba anterior seguía esperando que `summarizeReadingWork` devolviera un suplemento como siguiente unidad, contradiciendo la política introducida en la Iteración 29.
- [x] Corregida la expectativa de regresión para exigir la siguiente unidad narrativa requerida (`w:3`) después de omitir `w:2` como material suplementario.
- [ ] Confirmar CI completo sobre el commit de corrección antes de dar la iteración por validada.

**Resultado:** la suite vuelve a expresar una única semántica para seguimiento y orientación: el porcentaje y la siguiente lectura requerida usan el mismo conjunto de unidades narrativas, mientras el material suplementario sigue siendo registrable sin bloquear la obra.
