# Hoid IA — Run 182: procedencia por afirmación en todos los niveles

## Objetivo

Garantizar que cada afirmación visible de una explicación conserve su correspondencia exacta con las evidencias que la respaldan, tanto en respuestas breves como detalladas y comparativas.

## Hallazgo

La política anterior exigía `segments` y `layout` validados únicamente cuando la profundidad era `comparative`. Los modos `brief` y `detailed` podían aceptar una presentación con citas globales, pero sin un mapa explícito entre cada afirmación y sus evidencias.

Aunque el runtime estricto reconstruye segmentos desde el registro local de afirmaciones aprobadas, la frontera final de presentación debía exigir esa misma garantía en los tres modos públicos.

## Cambios

- Los tres presupuestos públicos establecen `requireSegmentProvenance: true`.
- Solo `comparative` conserva `requireCrossWorkSegment: true` y `minimumWorks: 2`.
- `presentHoidExplanation()` devuelve `segment-provenance-required` cuando falta el mapa validado entre afirmación y evidencia.
- La comprobación de procedencia se ejecuta antes del requisito de número mínimo de obras, para clasificar correctamente una ausencia de segmentos.
- Las pruebas cubren los tres modos, la retención completa de respuestas sin segmentos y la continuidad del presupuesto por la fachada de cursores.
- La política de profundidad documenta que cada segmento debe conservar el ID de afirmación y sus IDs de evidencia exactos.

## Orden de seguridad

1. Canonicalizar la respuesta.
2. Revalidar todas las fuentes contra la edición y el progreso vivo de cada obra.
3. Reconstruir las citas de cada segmento desde los metadatos locales.
4. Exigir el mapa claim-to-evidence para cualquier profundidad pública.
5. Aplicar límites de afirmaciones, evidencias, obras y caracteres.
6. En modo comparativo, exigir además una afirmación respaldada por evidencias de al menos dos obras.

La profundidad nunca amplía la frontera de spoilers. Una respuesta sin procedencia suficiente se retiene completa; no se trunca ni se reescribe.

## Validación final

HEAD validado: `8c0f385920ebacc76e13a07c8bb4c93fd673a328`.

- Política de profundidad: 132/132 pruebas satisfactorias en cinco suites.
- TypeScript estricto de la frontera de explicación: satisfactorio.
- GitHub Actions: 10/10 workflows aplicables satisfactorios.
- El primer intento detectó una clasificación incorrecta cuando una comparación carecía de segmentos y solo tenía una obra. Se reordenó la validación para devolver `segment-provenance-required` antes de comprobar el mínimo de obras; el HEAD final superó todas las comprobaciones.

## Privacidad y estado editorial

- No se han inspeccionado EPUBs ni se han añadido hechos narrativos.
- No se ha incorporado texto protegido, XHTML, pasajes, imágenes ni rutas privadas.
- No se ha cambiado el progreso de lectura, los umbrales N+1, la allowlist de capítulos ni los manifiestos.
- No se ha aprobado ningún resumen ni se ha activado conocimiento de producción.
- Los contratos siguen siendo independientes de proveedores; el selector devuelve IDs y el runtime local conserva el texto editorial aprobado.

## Aislamiento

- Rama: `feat/hoid-ia-core-run182`.
- Base: `feat/hoid-ia-core-run181`.
- SHA base: `0ab9b2657fd3fa66b1675ca8e31b52a83f7e6a2c`.
- El PR #75 permanece abierto en borrador y no se fusiona automáticamente.
- `main`, PR #74 y las ramas anteriores permanecen intactas.
