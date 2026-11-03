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
