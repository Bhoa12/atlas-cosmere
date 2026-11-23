# Run 255 — contrato de navegación hacia un lector EPUB

## Objetivo

Definir una frontera provider-neutral entre las recomendaciones edition-bound de Hoid y un futuro host lector. La aplicación actual no contiene una pantalla/ruta de lectura EPUB conectada desde \`App.tsx\`; por tanto, este run entrega el contrato y el adaptador comprobable, pero no afirma que ya se abra un capítulo en la interfaz.

## Contrato

\`recommendationReaderPort.ts\` define:

- \`HoidRecommendationReaderPort\`: capacidad host-owned para abrir un capítulo verificado.
- \`HoidRecommendationReaderOpenRequest\`: destino edition-bound, revisión y fingerprint del progreso, y señal opcional de cancelación.
- \`HoidVerifiedReaderChapterTarget\`: cursor canónico, manifiesto, edición, digest de navegación y localizador opaco verificado.
- \`openHoidRecommendationChapter()\`: orquestador que refresca el progreso durable, vuelve a ejecutar \`prepareHoidRecommendationNavigationHandoff()\` y llama al host solo si el destino sigue vigente.

## Reglas de seguridad

1. El adaptador realiza una lectura durable del progreso justo antes de preparar el handoff.
2. La revisión y el fingerprint deben coincidir con la presentación que originó la recomendación.
3. Se exige selección explícita cuando hay varias obras activas.
4. Los destinos \`catalog-only\` y \`cursor-only\` nunca se convierten en rutas ni nombres de archivo.
5. El host recibe únicamente un \`locatorId\` opaco y los metadatos exactos de la edición; no recibe href, URL, ruta de sistema de archivos ni texto EPUB.
6. El host debe resolver el localizador exclusivamente dentro de la edición identificada, revalidar la identidad del progreso inmediatamente antes de abrir y respetar \`AbortSignal\` hasta el punto de commit.
7. Abrir un capítulo no modifica el ledger. El avance de lectura pertenece al coordinador de progreso y a una acción explícita del lector.
8. La respuesta \`opened\` del host debe repetir exactamente libro, capítulo, edición y localizador. Cualquier discrepancia se rechaza.
9. Los errores del host se convierten en resultados acotados; no se propagan mensajes ni excepciones a la conversación.

## Límite de integración actual

\`App.tsx\` contiene Atlas, herramientas, Hoid, tests, comunidad y perfil, pero no una pantalla/ruta de lector EPUB. HoidScreen sigue mostrando que la apertura requiere un lector de capítulos. No se ha añadido un botón que prometa una apertura inexistente ni se ha creado un destino ficticio.

El siguiente paso de integración requiere una pantalla lectora real que implemente \`HoidRecommendationReaderPort\` usando el proveedor EPUB local y el router/controlador de lectura de Atlas. Hasta entonces, la capacidad no se inyecta en HoidScreen y el resultado correcto es \`reader-unavailable\`.

## Pruebas

La suite sintética cubre:

- Apertura con localizador verificado y comprobación de que no se pasan rutas.
- Progreso obsoleto y selección múltiple.
- Rechazo de localizadores cursor-only y destinos de catálogo.
- Ausencia del host lector.
- Confirmaciones que apuntan a otro libro, capítulo, edición o localizador.
- Getters y trampas de Proxy en las confirmaciones.
- Cancelación antes de leer, después de la lectura durable y durante una confirmación tardía.
- Errores y resultados no disponibles del host.

Las pruebas usan fixtures sintéticos y no incorporan hechos narrativos.

## Privacidad y spoilers

Este módulo solo transporta metadatos de navegación y progreso. No lee EPUB/XHTML, no copia texto protegido, no crea resúmenes, no autoriza evidencias y no cambia el ledger. La apertura de un capítulo no equivale a desbloquear su contenido para Hoid: la autorización narrativa sigue siendo una comprobación independiente por obra y capítulo.
