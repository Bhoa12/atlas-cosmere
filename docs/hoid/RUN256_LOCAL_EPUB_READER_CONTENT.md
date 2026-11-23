# Run 256 — lector EPUB local y contenido efímero

## Objetivo

Cerrar la primera integración vertical entre una recomendación edition-bound de Hoid, la fuente EPUB seleccionada explícitamente y la presentación local de un capítulo. Run 256 no crea un renderer EPUB completo: incorpora un lector textual por capítulo con una frontera de seguridad verificable.

## Flujo

1. El usuario selecciona un archivo EPUB local mediante el proveedor Expo existente.
2. Selecciona explícitamente una obra y una edición del catálogo.
3. El servicio de ingestión verifica ZIP, OCF, OPF, manifest, spine, navegación y digest de la edición.
4. Hoid solo muestra el botón de apertura cuando una recomendación vigente corresponde a la obra/edición seleccionada.
5. `openHoidRecommendationChapter()` refresca SQLite y vuelve a validar revisión, fingerprint, cursor, manifiesto y localizador.
6. El host vuelve a refrescar el progreso, resuelve el sufijo del localizador únicamente contra el manifiesto exacto y llama a `readChapterContent()`.
7. El servicio lee el XHTML local, revalida paquete/navegación/capítulo, compara el digest del documento y devuelve bloques de texto plano.
8. El host vuelve a refrescar SQLite antes de presentar. Si cambia el progreso, se cancela la operación o se libera la fuente, no se muestra el contenido.

## Contratos

- `HoidEpubXmlPort.extractReadableBlocks()`: capacidad opcional del parser XML para convertir XHTML validado en bloques de texto.
- `HoidEpubIngestionService.readChapterContent()`: lectura efímera de un único documento XHTML perteneciente a la navegación de un candidato de paquete emitido por esa misma instancia del servicio.
- `HoidRecommendationReaderPort`: host que abre únicamente el destino verificado y confirma exactamente obra, capítulo, edición y localizador.
- `createHoidLocalEpubRecommendationReaderPort()`: adaptador local testeable que encapsula cursor/manifiesto, progreso durable, cancelación, epoch de notificaciones y lectura de contenido.
- `HoidEpubImportPanel.onReaderPortChange`: registra la capacidad solo mientras fuente, obra, edición y candidato están activos.

## Seguridad

- El host comprueba la identidad del progreso antes y después de leer el capítulo.
- El localizador opaco se compara con el cursor y la unidad del manifiesto; no se acepta una ruta arbitraria.
- La lectura se realiza mediante el proveedor local existente, con límites de ZIP, tamaño de miembro, CRC, XML, nodos y profundidad ya aplicados.
- Se rechazan scripts, estilos, navegación, SVG, medios embebidos, formularios y elementos ocultos por atributo `hidden`, `aria-hidden=true` o estilos inline `display:none`/`visibility:hidden`.
- La interfaz recibe exclusivamente bloques congelados `heading`, `paragraph`, `quote` y `list-item`. Nunca recibe HTML, bytes, URI del dispositivo, URL ni ruta de archivo.
- El texto vive solo en el estado de la pantalla. Se elimina al cambiar el progreso, cambiar/liberar la fuente o desmontar el panel.
- El lector no escribe en SQLite ni cambia el cursor. Abrir un capítulo no equivale a registrar que se ha leído.
- El contenido no se envía al proveedor de Hoid, no se persiste, no se incorpora a allowlists editoriales y no aprueba afirmaciones.

## Alcance y limitaciones

Esta versión es un lector textual por capítulo. No implementa paginación EPUB, CSS, imágenes, tipografía, audio/vídeo, anotaciones, marcadores ni búsqueda de texto. No procesa ni guarda resúmenes narrativos. Las obras sin localizador verificado continúan sin apertura automática. La cobertura de edición sigue siendo la definida por los manifiestos; no se infiere una segmentación para Arena blanca ni para colecciones.

La extracción de texto sirve para lectura local, no para autorizar conocimiento de Hoid. La autorización narrativa sigue dependiendo de afirmaciones y evidencias editoriales revisadas por libro y capítulo.

## Pruebas

- Parser XML: orden de bloques, etiquetas inline, saltos de línea, contenido oculto y elementos activos/de navegación excluidos.
- Ingestión: lectura de un capítulo de fixture sintético, ausencia de HTML/bytes en el resultado, detección de sustitución del documento y fallo seguro si el parser no ofrece extracción.
- Host lector (9 escenarios): apertura exacta, progreso obsoleto antes/después de leer, carrera del epoch de eventos, cancelación durante la lectura, fuente liberada, obra distinta, ausencia de extractor y rechazo de getters/Proxy.
- Reader port: propagación de `stale-progress` desde el host.
- Workflows: importación EPUB local, parser/ingestión, contrato del reader port, navegación edition-bound y TypeScript estricto.

Los fixtures son sintéticos. En este run no se inspeccionaron nuevos EPUB privados ni se copiaron pasajes al repositorio.
