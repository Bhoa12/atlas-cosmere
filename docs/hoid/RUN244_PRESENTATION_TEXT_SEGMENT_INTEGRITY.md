# Run 244 — coherencia entre texto y procedencia segmentada

## Hallazgo

La validación confiable `presentHoidEvidenceAnswer()` ya recompone las afirmaciones mediante el compositor determinista y compara el resultado con el texto presentado. Sin embargo, la comprobación posterior `validateHoidPresentedAnswerScope()` solo verificaba que los segmentos y las citas coincidieran entre sí. No repetía la igualdad entre el texto global y la composición de los segmentos.

La autoridad confiable sigue siendo la fuente de autorización; esta iteración añade defensa en profundidad en la frontera de ámbito que alimenta la matriz transversal.

## Cambio

- Validar `layout` contra `HOID_NARRATIVE_LAYOUTS`, el enum cerrado.
- Reutilizar `composeHoidNarrative()` para recomponer únicamente los segmentos ya canonicalizados.
- Exigir igualdad exacta entre el texto recompuesto y `presentation.text`.
- Rechazar presentaciones segmentadas con texto global divergente o layouts no admitidos.
- Mantener sin cambios el contrato heredado de presentaciones no segmentadas.

El compositor solo aplica numeración, agrupación y separadores deterministas. No redacta, parafrasea ni altera las afirmaciones.

## Reparación de CI de Run 243

La primera validación de Run 243 detectó una plantilla literal escapada incorrectamente en el fixture de pruebas: los caracteres de escape se habían guardado literalmente y esbuild rechazaba el archivo antes de ejecutar esa suite. Run 244 restaura el template literal TypeScript válido. No se cambió la lógica de autorización para hacer pasar las pruebas.

## Pruebas añadidas

- Rechazar texto global que no sea exactamente la composición de los segmentos.
- Rechazar un layout fuera del enum cerrado.
- Conservar la aceptación del formato `plain` válido y la correspondencia exacta de evidencias.

## Límites de confianza

Esta comprobación no sustituye al presentador confiable, no concede acceso narrativo, no modifica progreso y no lee EPUB/XHTML. La autorización por libro/capítulo, edición y localizador continúa en el runtime confiable. El proveedor sigue sin poder redactar texto libre ni elegir evidencias fuera del conjunto autorizado.

## Privacidad

No se inspeccionaron ni se incorporaron EPUBs, XHTML, pasajes protegidos, rutas privadas, resúmenes nuevos ni afirmaciones editoriales. Solo se modificaron contratos, pruebas y documentación.
