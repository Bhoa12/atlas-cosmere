# Run 257 — confirmación explícita de progreso desde el lector EPUB

## Objetivo

Permitir que el lector local registre que el usuario ha terminado el capítulo abierto, sin inferir progreso por abrir, mostrar o desplazar contenido. La escritura debe quedar vinculada al mismo snapshot que autorizó la apertura del capítulo.

## Flujo

1. Hoid abre un capítulo mediante una recomendación edition-bound y conserva la revisión y huella del progreso que autorizaron la apertura.
2. El lector muestra una acción independiente: **Marcar capítulo como leído**.
3. La aplicación solicita confirmación explícita del usuario e informa de que cambiará el límite de spoilers.
4. CosmereContext.setCapituloLibroIfCurrent() delega en HoidCursorProgressCoordinator.advanceIfCurrent().
5. El coordinador serializa la operación y vuelve a cargar el ledger SQLite v2 dentro de la misma cola.
6. Compara revisión y fingerprint duraderos con el binding que acompañaba al capítulo abierto.
7. Exige que el capítulo sea exactamente el siguiente ordinal pendiente (o que ya sea el mismo cursor); no permite saltos ni regresiones.
8. compareAndSwap confirma la escritura durable. Solo después se emiten las notificaciones de progreso.
9. Hoid invalida el contenido abierto y las recomendaciones/respuestas anteriores, y vuelve a calcular los límites narrativos con el nuevo progreso.

## Contrato del coordinador

advanceIfCurrent(bookId, cursor, expectedRevision, expectedFingerprint):

- valida obra y cursor contra el manifiesto de edición;
- exige revisión entera no negativa y fingerprint SHA-256 hexadecimal;
- lee el snapshot durable, no el valor cacheado de React;
- devuelve conflict con el snapshot actual si cambió la proyección desde la apertura;
- exige cursor.ordinal === current.ordinal + 1 (o capítulo 1 para una obra aún no iniciada);
- permite que una repetición exacta devuelva unchanged;
- rechaza obras completadas, saltos, regresiones y cursores incompatibles;
- utiliza el compare-and-swap existente para detectar una escritura concurrente posterior a la lectura.

El fingerprint es una vinculación de frescura, no una firma ni una autorización narrativa.

## Interfaz

- Abrir un capítulo no cambia el ledger.
- La acción de marcar como leído requiere confirmación expresa.
- Si el progreso cambió desde que se abrió el capítulo, no se escribe nada y se pide volver a solicitar recomendaciones.
- Si la obra ya está completada, no se modifica.
- Si la estructura no tiene un manifiesto numérico verificable, el cursor no puede construirse y la acción falla de forma cerrada.

## Corrección del extractor XHTML

Run 257 corrige también un defecto real detectado en la CI de Run 256: los elementos inline (por ejemplo, strong) se emitían como bloques paragraph independientes después de que su texto ya estuviera incluido en el párrafo padre. Ahora solo los elementos semánticos de bloque producen bloques de lectura; el texto inline se agrega una sola vez al bloque contenedor.

## Pruebas

- Extracción XHTML con texto inline: no duplica el contenido de strong.
- Coordinador: avance secuencial con binding vigente.
- Coordinador: conflicto si otro coordinador cambia el ledger.
- Coordinador: rechazo de saltos de capítulo.
- Coordinador: rechazo de fingerprints malformados.
- Host lector: transmite revisión y fingerprint al callback de capítulo abierto.
- Workflow EPUB: Vitest y TypeScript estricto incluyen el coordinador y la integración React Native.

Los fixtures de prueba son sintéticos. No se inspeccionan EPUB privados en CI.

## Privacidad y spoilers

El texto del capítulo sigue siendo local y efímero. No se persiste, no se envía al proveedor de Hoid y no se añade al registro editorial. La única escritura es el cursor explícitamente confirmado por el usuario. El avance cambia la autorización de evidencia mediante los mecanismos existentes; no aprueba resúmenes ni afirmaciones narrativas nuevas.
