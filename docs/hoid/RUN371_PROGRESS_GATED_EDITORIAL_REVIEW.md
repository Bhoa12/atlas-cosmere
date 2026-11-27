# Run 371 — espacio de revisión editorial limitado por progreso

## Objetivo

Convertir la cola de metadatos de Run 369 y la persistencia SQLite de Run 370 en un flujo de revisión local utilizable, sin convertir una decisión local en autoridad de producción.

## Proyección del espacio de trabajo

`projectHoidEditorialReviewWorkspace` compone:
- el catálogo de borradores originales;
- los paquetes editoriales deterministas de Run 340/369;
- los recibos locales validados;
- la proyección canónica del cursor de lectura.

Solo devuelve resúmenes de paquetes cuyo límite `unlock` ya está alcanzado por el progreso validado. Los borradores de capítulos futuros se omiten completamente: no hay placeholders, recuentos retenidos ni títulos futuros.

La proyección de workspace es distinta de la cola de metadatos:
- `summaryTextIncluded` puede ser `true` únicamente si hay paquetes visibles;
- `sourceTextIncluded` permanece `false`;
- no se devuelven localizadores EPUB, hashes documentales, rutas ni URI;
- la disponibilidad actual de los EPUB permanece `not-audited`.

El contenido mostrado es un resumen editorial original de staging, no texto extraído del EPUB. La huella documental registrada vincula el borrador a una edición, pero esta pantalla no vuelve a inspeccionar el archivo privado.

## Interfaz de revisión

`HoidEditorialReviewWorkspacePanel`:
- exige que el registro SQLite esté validado y que el progreso sea verificable;
- permite revisar solo paquetes visibles dentro del progreso completado;
- exige cinco controles para una aprobación local: exactitud, cobertura, originalidad, límite de spoilers y trazabilidad;
- genera códigos de incidencia cerrados para solicitudes de corrección o rechazo;
- vuelve a cargar el progreso del lector antes de cada escritura;
- cierra el resumen si el progreso ya no autoriza el paquete.

No se permite revisar un paquete que ya tenga un recibo local. La interfaz no ofrece identidad autenticada ni firma.

## Contrato de aplicación

`HoidEditorialReviewSubmissionPort` es independiente de Expo y SQLite. La implementación recibe el puerto de almacenamiento existente y:
1. canonicaliza la solicitud sin ejecutar getters;
2. vuelve a leer y validar el snapshot actual;
3. vuelve a proyectar la cola con el progreso recién actualizado;
4. exige que el paquete siga visible y pendiente;
5. reconstruye el paquete desde el catálogo actual;
6. valida la decisión y el checklist;
7. persiste con compare-and-swap;
8. vuelve a leer y validar el snapshot persistido antes de notificar a la interfaz.

Las escrituras concurrentes devuelven `conflict`; no hay reintento silencioso ni sobrescritura.

## Autoridad y spoilers

El identificador de revisor `device-local-unverified` es una etiqueta técnica, no una identidad autenticada.

Una aprobación local:
- permanece `approved-awaiting-source-promotion`;
- no firma el paquete;
- no cambia el registro editorial de producción;
- no autoriza respuestas narrativas;
- no altera cursores ni permisos de spoilers.

La promoción sigue requiriendo la autoridad editorial protegida e independiente del control de versiones.

## Privacidad y proveedores

- No se almacenan resúmenes ni pasajes en SQLite.
- El resumen original solo se presenta en memoria y después de superar el límite de progreso.
- No se leen EPUB/XHTML durante la revisión.
- No se envía contenido a proveedores externos.
- No se afirma que el EPUB esté actualmente accesible.
- El almacenamiento sigue siendo local y no se afirma cifrado de base de datos.

## Validación

El workflow Run 371 ejecuta:
- pruebas de proyección con progreso completo, vacío e inválido;
- aprobaciones incompletas y solicitudes de corrección;
- elegibilidad revalidada antes de guardar;
- compare-and-swap, conflicto y corrupción;
- minimización del recibo persistido;
- regresiones de cola, paquetes, SQLite y runtime de cursores;
- TypeScript estricto para el módulo, los componentes y los hosts integrados.
