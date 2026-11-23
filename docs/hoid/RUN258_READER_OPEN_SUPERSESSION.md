# Run 258 — latest-open-wins para el lector EPUB local

## Problema

Un mismo host de lectura puede recibir dos llamadas asíncronas aunque la pantalla habitual desactive los toques duplicados. Si la primera lectura XHTML tarda más que la segunda, sin una identidad de intento la primera podría terminar después y sustituir el capítulo más reciente en la interfaz.

## Contrato

`createHoidLocalEpubRecommendationReaderPort()` mantiene una generación monotónica privada por instancia del host.

- Cada llamada a `openVerifiedChapter()` incrementa la generación antes de validar la solicitud.
- La operación captura su generación.
- Tras cada frontera asíncrona (lectura durable inicial, extracción XHTML y lectura durable final) comprueba que sigue siendo la más reciente.
- La comprobación se repite inmediatamente antes de `onChapterOpened()`.
- Una operación anterior devuelve `unavailable / superseded` y nunca presenta su contenido.
- La cancelación explícita conserva prioridad y devuelve `cancelled`.
- La generación no se comparte entre hosts ni altera el ledger, el progreso o la autorización narrativa.

Una nueva solicitud inválida también invalida una solicitud anterior en curso: el host adopta una política estricta de última intención.

## Límite

La extracción XHTML no acepta actualmente un `AbortSignal`; por tanto, una lectura ya iniciada puede seguir consumiendo recursos hasta terminar. La generación evita que su resultado tardío se presente, pero no afirma cancelar físicamente el trabajo del proveedor local. La cancelación cooperativa de la extracción queda como mejora separada del puerto de ingestión.

## Pruebas

- La primera apertura queda pendiente durante la lectura XHTML.
- Una segunda apertura termina y presenta su capítulo.
- La primera se resuelve después y devuelve `superseded`.
- `onChapterOpened` se invoca una sola vez, para la apertura más reciente.
- El reader port exterior conserva `superseded` como resultado acotado, sin convertirlo en un error de acknowledgement.

Los fixtures son sintéticos; no se leen EPUB privados en CI.
