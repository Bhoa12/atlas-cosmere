# Run 257 — confirmación explícita de progreso desde el lector EPUB

## Objetivo

Permitir que el lector local registre que el usuario ha terminado el capítulo abierto, sin inferir progreso por abrir, mostrar o desplazar contenido. La escritura debe quedar vinculada al mismo snapshot que autorizó la apertura del capítulo.

## Semántica del cursor

El cursor de Atlas representa el capítulo que el lector tiene actualmente abierto, no el último capítulo completado. Por tanto, si el cursor estaba en el capítulo 21 y Hoid abre el 22, confirmar que se ha leído el 22 debe mover el cursor al 23. La proyección de spoiler existente considera completados los capítulos anteriores al cursor.

El último capítulo requiere una acción distinta: **Marcar libro como completado**. La finalización no se deduce del cursor ni de abrir/desplazarse por el capítulo final.

## Flujo

1. Hoid abre un capítulo mediante una recomendación edition-bound y conserva la revisión y huella del progreso que autorizaron la apertura.
2. El lector muestra una acción independiente para marcar el capítulo como leído.
3. Si es el último capítulo de una segmentación numérica completa, la acción cambia a marcar el libro como completado.
4. La aplicación solicita confirmación expresa e informa de que cambiará el límite de spoilers.
5. CosmereContext delega en HoidCursorProgressCoordinator.
6. El coordinador serializa la operación y vuelve a cargar el ledger SQLite v2 dentro de la misma cola.
7. Compara revisión y fingerprint duraderos con el binding que acompañaba al capítulo abierto.
8. Verifica que el capítulo abierto era exactamente el siguiente capítulo pendiente.
9. Para capítulos no finales, persiste el cursor del capítulo siguiente. Para el capítulo final de un manifiesto completo, persiste completion explícito.
10. compareAndSwap confirma la escritura durable. Solo después se emiten las notificaciones de progreso.
11. Hoid invalida el contenido abierto y las recomendaciones/respuestas anteriores, y vuelve a calcular los límites narrativos con el nuevo progreso.

## Contratos del coordinador

### markChapterReadIfCurrent(bookId, completedChapterNumber, expectedRevision, expectedFingerprint)

- valida obra y capítulo contra el manifiesto de edición;
- exige revisión entera no negativa y fingerprint SHA-256 hexadecimal;
- recarga el snapshot durable, no confía en la caché de React;
- devuelve conflict si la proyección cambió desde la apertura;
- exige que el capítulo leído sea exactamente el cursor actual + 1 (o capítulo 1 para una obra no iniciada);
- mueve el cursor al capítulo siguiente, porque el cursor representa el capítulo actualmente abierto;
- rechaza saltos, regresiones, obras completadas y segmentaciones que no tengan un siguiente cursor inequívoco;
- si se trata del último capítulo de un manifiesto completo, exige usar el contrato separado de finalización.

### completeAfterReadingIfCurrent(bookId, finalChapterNumber, expectedRevision, expectedFingerprint)

- solo acepta manifiestos con cobertura numérica completa;
- exige que el capítulo indicado sea el último del manifiesto y el siguiente capítulo pendiente;
- requiere la misma vinculación de progreso y compare-and-swap;
- exige un objeto de confirmación canónico sin getters ni propiedades adicionales;
- registra completion explícito; nunca se infiere de abrir o desplazarse por el capítulo.

El fingerprint es una vinculación de frescura, no una firma ni una autorización narrativa.

## Interfaz

- Abrir un capítulo no cambia el ledger.
- La acción de marcar como leído requiere confirmación expresa y un contrato que rechaza confirmaciones malformadas.
- La finalización requiere confirmación separada y solo aparece para el último capítulo de una segmentación numérica completa.
- Si el progreso cambió desde que se abrió el capítulo, no se escribe nada y se pide volver a solicitar una recomendación.
- Si la edición solo tiene una cobertura parcial antes de un capítulo ambiguo, el lector no inventa el siguiente cursor ni ofrece completar la obra.

## Corrección del extractor XHTML

Run 257 corrige un defecto real detectado en la CI de Run 256: los elementos inline (por ejemplo, strong) se emitían como bloques paragraph independientes después de que su texto ya estuviera incluido en el párrafo padre. Ahora solo los elementos semánticos de bloque producen bloques de lectura; el texto inline se agrega una sola vez al bloque contenedor.

## Pruebas

- Extracción XHTML con texto inline: no duplica el contenido de strong.
- Coordinador: marcar capítulo N leído mueve el cursor a N+1.
- Coordinador: conflicto si otro coordinador cambia el ledger.
- Coordinador: rechazo de saltos de capítulo.
- Coordinador: rechazo de fingerprints malformados.
- Coordinador: el último capítulo exige finalización explícita.
- Coordinador: no permite completar antes del último capítulo.
- Host lector: transmite revisión y fingerprint al callback de capítulo abierto.
- Workflow EPUB: Vitest y TypeScript estricto incluyen el coordinador y la integración React Native.

Los fixtures de prueba son sintéticos. No se inspeccionan EPUB privados en CI.

## Privacidad y spoilers

El texto del capítulo sigue siendo local y efímero. No se persiste, no se envía al proveedor de Hoid y no se añade al registro editorial. La única escritura es el cursor o completion explícitamente confirmado por el usuario. El avance cambia la autorización de evidencia mediante los mecanismos existentes; no aprueba resúmenes ni afirmaciones narrativas nuevas.
