# Hoid IA — Run 365: puente local de acceso editorial a EPUB

## Objetivo

Conectar el contrato de inspección de fuentes de Run 363/364 con el lector EPUB local ya existente, sin crear un segundo parser ZIP ni introducir un proveedor narrativo.

## Arquitectura

`createHoidEpubEditorialSourceAccessRouter()` compone sesiones efímeras que contienen:

- El `sourceId` opaco del proveedor local.
- El `HoidEpubPackageInspectionCandidate` inmutable emitido por la inspección local.
- El servicio provider-neutral `HoidEpubIngestionService`.
- Una función `isCurrent()` que invalida la sesión al liberar/cambiar la fuente o el contexto.

Cada sesión queda asociada a un único `workId`. El router permite varias obras simultáneas; un EPUB combinado puede compartir un `sourceId`, pero cada obra conserva su propio candidato de paquete. Los duplicados de `workId` se rechazan para evitar selección ambigua.

## Secuencia de inspección

1. Validar la forma exacta de la petición: obra, edición, huella de navegación, capítulo, locator y digest esperado.
2. Resolver la sesión activa por `bookId`; nunca por nombre de archivo.
3. Revalidar la edición y la navegación contra el manifiesto local.
4. Exigir que el locator coincida con el índice de navegación verificado.
5. Exigir un digest XHTML presente en la allowlist dispersa de documentos inspeccionados.
6. Derivar el href relativo únicamente desde el locator verificado y rechazar rutas absolutas, traversal, escapes, query o fragmentos.
7. Invocar `inspectChapterDocument()` del servicio de ingestión existente. Este vuelve a comprobar el paquete, inventario, OPF, navegación, XHTML y digest del documento.
8. Validar la respuesta exacta y comprobar de nuevo que la sesión sigue vigente.
9. Devolver únicamente `{ status: "available", documentSha256 }`.

Los resultados rechazados, errores de parser, sesiones caducadas, cancelaciones y documentos no inspeccionados se reducen a estados opacos sin filtrar rutas, excepciones ni contenido.

## Límites de seguridad

- El router no abre archivos ni accede a rutas del sistema; recibe el servicio de ingestión local ya compuesto por el host.
- El candidato de paquete debe ser inmutable y estar ligado a `sourceId`, obra, edición y digest de navegación.
- El servicio real de ingestión conserva su comprobación de identidad interna del candidato (WeakMap); clonar un candidato no autoriza la lectura.
- El router no devuelve bytes, XHTML, texto extraído, títulos, identificadores privados ni URI.
- El router no crea resúmenes, afirmaciones, recibos, desbloqueos ni escrituras de producción.
- La existencia de un locator no basta: un capítulo sin digest de cuerpo verificado permanece bloqueado.
- Una inspección de fuente solo acredita disponibilidad e integridad del documento; no demuestra que un editor haya leído el pasaje ni aprueba una afirmación.
- El preflight de promoción sigue imponiendo su timeout, revisión firmada, quorum, progreso y controles del host de confianza.

## Catálogo y fuentes

Se reutilizan los 24 registros bibliográficos, manifiestos de edición, locators y digests sparse existentes. No se amplía la cobertura narrativa por inferencia. Las obras sin segmentación verificable o sin digest de capítulo siguen devolviendo estado no disponible.

## Pruebas

`epubEditorialSourceAccess.test.ts` cubre:

- Inspección válida y salida limitada al digest.
- Enrutamiento de varias obras y aislamiento de candidatos.
- Fuente ausente, sesión obsoleta y cancelación.
- Digest no allowlisted y capítulos con navegación pero sin cuerpo inspeccionado.
- Respuestas con texto/XHTML o digest alterado.
- Sesiones duplicadas, getters y peticiones con campos adicionales.
- Candidatos asociados a otra obra.

Las pruebas usan servicios y datos sintéticos. No demuestran que los EPUB privados estén montados en CI.

## Estado

La integración está preparada para que el host entregue sesiones locales activas al router. No se ha añadido una conexión automática al flujo de promoción, ni se ha habilitado promoción automática. En esta ejecución no se han abierto los EPUB privados ni se ha inspeccionado nuevo contenido narrativo.
