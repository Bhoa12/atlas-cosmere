# Roshar R0 — auditoría inicial del modelo actual

**Rama inspeccionada:** `fix/atlas-core-audit`  
**Alcance:** consumidores principales del catálogo de obras, progreso y desbloqueos.  
**Estado:** auditoría inicial; R0 no se declara cerrado hasta completar el barrido de referencias y validar los contratos en CI.

## Inventario de consumidores

| Archivo | Uso actual | Implicación para la migración |
|---|---|---|
| `src/data/cosmereUniverse.ts` | Define `Libro.totalCapitulos`, IDs históricos, personajes clave y datos de planeta embebidos. | Mantener IDs; separar catálogo editorial y afirmaciones atómicas sin romper la API legado de golpe. |
| `src/context/CosmereContext.tsx` | Persiste `librosLeidos` y `capituloActualPorLibro` en `@atlas-cosmere/state-v1`; expone `esContenidoDesbloqueado` a nivel de libro. | Añadir estado por unidad con migración versionada. No inferir que los capítulos previos están completados a partir de una frontera numérica sin consentimiento/regla explícita. |
| `App.tsx` | Presenta catálogo, progreso numérico y controles +/-; muestra sinopsis/personajes desde la ficha del libro. | Sustituir gradualmente el contador por navegador de unidades editoriales. Las fichas deberán consumir selectores protegidos. |
| `src/components/InvestitureWheel.tsx` | Usa `esContenidoDesbloqueado(mag.desbloqueoLibroId)` para sistemas mágicos y flora/fauna. | Reemplazar el gate por selectores de afirmaciones; no mantener un segundo sistema de spoilers en UI. |
| `src/screens/QuizzesScreen.tsx` | Consume rangos, puntos y `testsCompletadosExitosos`; el banco es estático. | Introducir metadatos de obra, unidad, fuente y spoiler gate por pregunta antes de ampliar el banco o generar con IA. |
| `src/screens/CommunityScreen.tsx` | Lee `capituloActualPorLibro`, `librosLeidos` y `totalCapitulos` para acotar teorías. | Consumidor legado que deberá adaptarse cuando exista el nuevo progreso. Comunidad queda fuera del alcance funcional de esta etapa. |
| `src/screens/ToolsScreen.tsx` | Usa `librosLeidos` para habilitar información asociada a libros. | Las herramientas deberán consultar el mismo servicio de visibilidad que la enciclopedia. |
| `src/screens/ProfileScreen.tsx` | Calcula logros a partir de IDs concretos de libros y estado de lectura. | Migrar criterios a definiciones tipadas y eventos de progreso, no a comprobaciones dispersas por pantalla. |
| `src/data/gamification.ts` | Mantiene logros y rangos estáticos. | Separar definición, estado del usuario e inventario de recompensas en una fase posterior. |

## Hallazgos verificados

1. El progreso actual no representa prólogos, interludios, epílogos ni unidades especiales.
2. El método `esContenidoDesbloqueado` acepta un ID de libro y devuelve si el libro está marcado como leído; no expresa revelaciones dentro de un libro.
3. El catálogo de Roshar actual usa los IDs históricos `twok`, `wor`, `edgedancer`, `o`, `dawnshard`, `row` y `wat`. Se conservarán como IDs persistentes.
4. El estado inicial de `CosmereContext` incluye valores precargados de demostración para `twok` y `tfe`. Antes de interpretar esos valores como progreso real habrá que distinguir instalaciones nuevas, datos demo y datos ya persistidos.
5. El catálogo mezcla metadatos editoriales con contenido de planeta y gates por libro. El modelo nuevo introduce contratos separados, pero aún no migra las pantallas ni los datos.
6. El proyecto no declara en `package.json` una suite de tests automatizados ni scripts de validación de catálogo.

## Contratos añadidos en esta iteración

- `src/data/roshar/model.ts`: tipos para obras, unidades de lectura, entidades, afirmaciones, referencias, gates y progreso; incluye validación estructural pura de unidades y gates.
- `src/data/roshar/catalog/works.ts`: adaptador del catálogo Roshar existente a los nuevos metadatos, conservando IDs. El orden de publicación queda `null` hasta verificarlo con una bibliografía autorizada; no se infiere de `ordenSaga`.

## Riesgos que siguen abiertos

- No se ha completado todavía el barrido exhaustivo de todos los usos de `totalCapitulos`, `desbloqueoLibroId`, `librosLeidos` y `capituloActualPorLibro`.
- La lista exacta de unidades editoriales de cada edición no está cargada. No se han inventado capítulos, interludios ni títulos.
- El significado exacto del valor legado `capituloActualPorLibro` (último capítulo alcanzado frente a todos los capítulos previos completados) requiere una migración conservadora.
- Los datos canónicos actuales del planeta no tienen referencias por afirmación y no deben considerarse listos para publicación progresiva.
- No se ha ejecutado todavía TypeScript, exportación Android ni CI sobre los nuevos archivos.

## Próximas tareas de R0/R1

1. Completar el barrido de consumidores y fijar los contratos de compatibilidad.
2. Definir la política de migración de `state-v1`, incluidos los valores demo de instalaciones nuevas.
3. Verificar bibliografía y orden de lectura con fuentes autorizadas.
4. Construir el catálogo de unidades de lectura solo a partir de índices/ediciones comprobados.
5. Añadir tests unitarios y validadores de catálogo antes de activar el motor de spoilers en la UI.


## Barrido de compatibilidad — segunda pasada

Se revisaron los archivos de aplicación y datos que consumen el modelo legado en la rama de trabajo. Los usos encontrados son:

| Archivo | Referencias encontradas | Decisión |
|---|---|---|
| `App.tsx` | `librosLeidos`, `capituloActualPorLibro`, `totalCapitulos`, `setCapituloLibro`, `toggleLibroLeido` | Mantener como UI de compatibilidad hasta disponer del catálogo completo de unidades; después sustituir los controles +/- por navegación de unidades. |
| `src/context/CosmereContext.tsx` | Persistencia `@atlas-cosmere/state-v1`, hidratación, guardado y cálculo de lectura por libro/capítulo | Punto único para la migración versionada. No derivar unidades completadas desde el contador antiguo. |
| `src/components/InvestitureWheel.tsx` | `esContenidoDesbloqueado` y `desbloqueoLibroId` | Migrar al selector de afirmaciones; evitar gates alternativos en el componente. |
| `src/screens/CommunityScreen.tsx` | `librosLeidos`, `capituloActualPorLibro`, `totalCapitulos` | Conservar temporalmente el límite de spoilers legado de publicaciones; adaptar a progreso granular en la fase de comunidad. |
| `src/screens/ToolsScreen.tsx` | `librosLeidos` | Reemplazar habilitaciones por libro por selectores de visibilidad comunes. |
| `src/screens/ProfileScreen.tsx` | `librosLeidos` | Migrar los criterios de logros a eventos/progreso granular cuando se implemente R7. |
| `src/data/cosmereUniverse.ts` | Declaración de `totalCapitulos` y `desbloqueoLibroId`; datos de Roshar y otros planetas | Mantener temporalmente la forma pública legado; no tratar sus textos como afirmaciones verificadas/publicables por sección. |
| `src/data/gamification.ts`, `src/screens/QuizzesScreen.tsx`, `src/data/continuityEngine.ts` | Sin referencias directas a los cuatro campos buscados | Siguen teniendo migraciones propias por criterios de logros, metadatos de tests y cobertura de spoilers. |

La búsqueda de código de GitHub opera sobre la rama por defecto, por lo que esta pasada se hizo leyendo los archivos de la rama `fix/atlas-core-audit` directamente. No se considera una prueba formal de ausencia de referencias en archivos no inspeccionados; se debe repetir como comprobación automatizada en el repositorio local/CI antes de retirar las interfaces legadas.

## Política conservadora de migración state-v1

1. Mantener intacta la clave `@atlas-cosmere/state-v1` durante la transición; no sobrescribirla con un esquema incompatible.
2. Leer y validar los campos antiguos conocidos de forma independiente, como ya hace el contexto. Un campo corrupto no debe invalidar los demás.
3. Conservar `librosLeidos` y `capituloActualPorLibro` como progreso legado visible mientras dure la compatibilidad.
4. No convertir `capituloActualPorLibro[n]` en una lista de unidades completadas: el dato solo expresa una posición numérica y no aclara si representa lectura continua, último capítulo visitado o una selección manual.
5. No convertir los valores iniciales de demostración (`twok` y `tfe`) en unidades completadas. El almacenamiento histórico no contiene un marcador fiable que permita distinguir todos los datos demo de progreso confirmado.
6. El nuevo progreso granular se inicia vacío y se guarda bajo una clave/esquema versionado independiente. Una futura migración solo podrá importar una unidad cuando exista evidencia inequívoca y una regla aprobada; nunca rellenará huecos ni prólogos/interludios/epílogos por inferencia.
7. No borrar la clave antigua hasta que la nueva estructura esté validada, persistida y recuperable; incluir respaldo/rollback y pruebas de JSON corrupto y almacenamiento no disponible.

## Pruebas automatizadas añadidas

- Se añadió un runner sin dependencias adicionales basado en `node:test` y el compilador TypeScript ya instalado.
- `npm test` cubre validación de unidades, IDs/ordinales, gates vacíos y desconocidos, evaluación `allOf`/`anyOf`, lectura no lineal, correspondencia obra-unidad y filtrado de afirmaciones no publicadas o sin fuente.
- La suite está añadida al repositorio; su ejecución real queda pendiente de CI.


## Hallazgos de la segunda inspección de implementación

La lectura directa de `CosmereContext.tsx`, `App.tsx`, `CommunityScreen.tsx` e `InvestitureWheel.tsx` confirma riesgos que deben resolverse antes de conectar el catálogo:

- `toggleLibroLeido` marca el libro como leído y fija el contador legado a `totalCapitulos`; `setCapituloLibro` interpreta el contador como una frontera continua y marca el libro completo al alcanzar ese total. Ninguna operación equivale a completar unidades editoriales explícitas.
- Si no existe estado guardado, el contexto parte de valores demo (`twok` y `tfe`) y, tras hidratarse, persiste el estado inicial. No se pueden importar esos valores como progreso real.
- El modal de `App.tsx` expone sinopsis y personajes desde el catálogo legado sin gates por afirmación. La rueda usa gates por libro y no puede proteger información dentro de una misma obra.
- La comunidad acota publicaciones por número de capítulo y permite revelar manualmente el texto de una publicación marcada como spoiler. Es un sistema separado, no una garantía de aislamiento de datos.
- La tabla NCX de referencia contradice dos valores del catálogo legado: `dawnshard.totalCapitulos = 21` frente a 19 capítulos numerados; `wat.totalCapitulos = 115` frente a 147 capítulos numerados en el NCX. No se debe modificar el catálogo legado a ciegas ni utilizar esos totales para construir progreso nuevo.
- Los demás recuentos principales coinciden con el NCX: `twok` 75, `wor` 89, `o` 122, `row` 117 y `edgedancer` 20. La coincidencia numérica no valida el tratamiento de material complementario.

### Estado actualizado de R0/R1

- El script `npm test` y la suite automatizada sí existen ya; la afirmación anterior de que faltaban se considera obsoleta.
- El catálogo NCX de las siete obras ya está importado y sus 684 destinos relativos resuelven a archivos existentes dentro de los EPUB.
- R0 no se cierra todavía: falta un barrido automatizado de referencias de código, cerrar la política de compatibilidad del progreso legado y cotejar los rótulos NCX contra los encabezados XHTML.
- R1 tiene un inventario estructural importado, pero no se considera editorialmente definitivo ni se conecta aún a UI/persistencia.
