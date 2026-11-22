# Run 243 — integridad de evidencia por afirmación

## Objetivo

Run 242 comprobaba que el conjunto global de citas perteneciera exactamente al ámbito de obras seleccionado. Run 243 refuerza esa frontera para que la procedencia visible de cada afirmación no pueda divergir de las citas globales que ya superaron la presentación confiable.

## Cambio

\`validateHoidPresentedAnswerScope()\` ahora valida la estructura de segmentos cuando la presentación incluye \`layout\` y \`segments\`.

Para cada segmento se exige:

1. Un registro plano con exactamente \`claimId\`, \`text\`, \`evidenceIds\` y \`citations\`.
2. Un \`claimId\` igual al elemento correspondiente de la lista canónica de afirmaciones.
3. Texto no vacío, recortado y dentro del límite de longitud.
4. IDs de evidencia densos, únicos y acotados.
5. Una cita por cada ID de evidencia del segmento.
6. Coincidencia exacta con la cita global en ID, obra, título, capítulo y localizador opaco.
7. Ausencia de evidencias globales huérfanas que no respalden ningún segmento.

La evidencia puede respaldar más de una afirmación, pero no puede aparecer dos veces dentro del mismo segmento ni cambiar de obra, capítulo o localizador entre la lista global y la lista del segmento.

## Fallo cerrado

Se rechazan sin ejecutar getters:

- Segmentos con propiedades accesoras.
- Arrays dispersos o con propiedades adicionales.
- IDs de afirmación desordenados o no coincidentes.
- Citas introducidas solo en un segmento.
- Citas con el mismo ID pero distinto capítulo/localizador.
- Evidencias globales no vinculadas a ningún segmento.
- Mapeos incompletos o malformados.

El resultado es una abstención neutral de presentación. No se muestra texto, citas ni contexto conversacional procedente de la respuesta rechazada.

## Límites de confianza

Esta comprobación no sustituye al presentador confiable. El presentador sigue validando la procedencia editorial, la edición, el localizador y el desbloqueo por libro/capítulo contra el progreso vigente.

La validación claim-to-evidence es una comprobación de consistencia en la frontera de UI. No lee EPUB/XHTML, no desbloquea capítulos, no modifica progreso, no elige proveedores y no promueve afirmaciones a producción.

Las presentaciones heredadas sin \`layout\` ni \`segments\` mantienen el contrato anterior. Si cualquiera de esos campos aparece, ambos deben estar presentes y el mapeo completo debe ser válido.

## Pruebas

Se añaden siete regresiones:

- Aceptar un segmento que coincide exactamente con sus citas globales.
- Rechazar una cita adicional introducida solo en el segmento.
- Rechazar un \`claimId\` que no coincide con la lista canónica.
- Rechazar cambios de capítulo/localizador para un ID existente.
- Rechazar evidencia global huérfana.
- Rechazar getters sin ejecutarlos.
- Rechazar arrays de segmentos dispersos.

## Privacidad

No se inspeccionan ni se incorporan EPUBs, XHTML, pasajes, resúmenes, localizadores privados ni afirmaciones narrativas nuevas. Solo se validan metadatos de presentación ya producidos por el runtime confiable.
