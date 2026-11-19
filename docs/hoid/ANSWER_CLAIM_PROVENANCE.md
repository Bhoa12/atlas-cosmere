# Hoid — trazabilidad de evidencia por afirmación

## Propósito

Cada afirmación mostrada debe conservar su propio vínculo con las evidencias editoriales que la respaldan. Una lista global de citas permite conocer las fuentes de una respuesta, pero no demuestra qué fuente respalda cada segmento.

## Contrato de salida

El runtime estricto emite, para cada afirmación seleccionada, un segmento inmutable con:

- identificador de la afirmación aprobada;
- texto exacto del registro editorial local;
- identificadores exactos de sus evidencias.

El proveedor externo sigue siendo un selector de identificadores. No redacta, reescribe, ordena ni amplía el texto. El runtime reconstruye los segmentos en el orden del registro editorial, no en el orden arbitrario de la respuesta del selector.

La presentación vuelve a validar el conjunto de segmentos, reconstruye las citas por obra/capítulo y recompone el texto mediante el compositor determinista. Si una cita no está autorizada, falta una relación segmento-evidencia o el texto no coincide con la composición, se retiene la respuesta completa.

## Presupuesto de evidencia

La presentación admite como máximo 16 evidencias únicas por respuesta. Si las afirmaciones seleccionadas requieren más fuentes, el runtime bloquea la respuesta completa en vez de eliminar citas silenciosamente. Los límites por afirmación y el límite global se mantienen alineados.

## Spoilers y obras cruzadas

Cada evidencia conserva su propia obra, capítulo de origen y umbral de desbloqueo. Todas las evidencias seleccionadas deben estar autorizadas en sus respectivos libros. Avanzar en una obra no desbloquea otra; las explicaciones transversales requieren que cada posición cruce su propio límite.

El cursor del capítulo N sigue significando «capítulo abierto/en curso»: únicamente N-1 se considera completado. La finalización explícita de una obra es la única condición que desbloquea su contenido completo.

## Privacidad y fuentes

Este contrato trabaja con afirmaciones originales aprobadas, identificadores, localizadores opacos y metadatos. No copia pasajes, no expone texto XHTML y no requiere enviar EPUBs privados a un proveedor.

El registro editorial de producción permanece vacío hasta que existan resúmenes originales respaldados por documentos efectivamente inspeccionados y aprobados. Las pruebas sintéticas no añaden conocimiento del Cosmere.

## Validación

El workflow `hoid-answer-presentation` ejecuta la presentación, la integración de trazabilidad por afirmación y las pruebas del runtime estricto, además de TypeScript estricto sobre ambos límites.
