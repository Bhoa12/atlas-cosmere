# Frontera de proveedores de Hoid IA

## Objetivo

Los proveedores de IA son intercambiables y no forman parte de la autoridad narrativa. La autorización de progreso, la recuperación y la prevención determinista de spoilers permanecen dentro de Hoid IA.

## Contrato mínimo que cruza la frontera

El contexto narrativo enviado a un proveedor contiene únicamente:

- `id`
- `kind`
- `summary` original, aprobado y no copiado de la fuente
- `evidenceSource.bookId`
- `evidenceSource.chapter`

Los `aliases` se usan solo para recuperación interna y no deben cruzar esta frontera.

Antes de construir un snapshot, la ruta de compatibilidad valida el progreso contra la estructura de la edición. Un capítulo fuera del rango numérico verificado, un cursor ambiguo o una obra sin segmentación segura se rechazan antes de invocar al proveedor; no se convierten en una lista vacía de progreso.

## Dos límites editoriales independientes

Hoid mantiene dos umbrales que no deben confundirse:

1. `firstSafeAppearance`: autoriza únicamente mencionar el nombre o alias de una entidad.
2. `evidenceUnlock`: autoriza revelar el resumen editorial completo, una vez alcanzada la posición de lectura indicada.

Una primera aparición temprana no autoriza los detalles de un resumen posterior. El resumen solo puede cruzar la frontera si:

- la procedencia está marcada como verificada;
- `evidenceSource` identifica el libro, capítulo y localizador exactos;
- el localizador coincide con el manifiesto de la edición verificada;
- `evidenceUnlock` es válido y el progreso completado alcanza ese umbral;
- el progreso no contiene posiciones duplicadas, inválidas o ambiguas.

La cita que recibe el proveedor identifica el capítulo que realmente respalda el resumen (`evidenceSource`), no la primera aparición de la entidad.

## Propiedades del snapshot

Las solicitudes y el contexto que cruzan la frontera deben ser snapshots desacoplados del estado mutable de la aplicación. Un proveedor no recibe referencias que puedan modificar posteriormente la autorización o el contexto local.

## Dos rutas de respuesta

### Texto libre de compatibilidad

Los proveedores tradicionales devuelven texto. Hoid IA aplica:

1. límite de tamaño;
2. guardia determinista de spoilers;
3. comprobación frente al catálogo bloqueado.

Esta ruta de compatibilidad no equivale al runtime estricto de claims y no debe recibir resúmenes cuyo `evidenceUnlock` no se haya alcanzado.

### Evidencia estructurada

Los proveedores que devuelven claims deben asociar cada afirmación con identificadores presentes en el contexto autorizado. Hoid IA valida los identificadores, aplica un presupuesto agregado a toda la respuesta y ejecuta las mismas barreras finales anti-spoilers que en la ruta de texto libre.

Ninguna forma estructurada de respuesta puede ampliar los permisos del proveedor ni eludir los límites globales.

## Fallos y tiempos de espera

La indisponibilidad, un timeout, datos con forma inválida o evidencia no autorizada no se sustituyen por conocimiento inventado. Hoid IA devuelve un resultado conservador que indica que no puede verificar una respuesta.

## Regla de evolución

Al añadir un proveedor nuevo, el adaptador debe depender de contratos de Hoid IA, no de SDKs dentro de la capa de dominio. Cualquier campo nuevo que cruce la frontera requiere:

- justificación de necesidad;
- revisión del presupuesto de contexto;
- pruebas de aislamiento e inmutabilidad;
- revisión de su impacto en spoilers y procedencia.


## Protocolo versionado de selección

El selector utiliza el contrato neutral de selección de afirmaciones, versión 1. Cada solicitud incluye versión, fingerprint SHA-256, pregunta, intención, candidatos autorizados y presupuesto cerrado. El fingerprint vincula también el snapshot de lectura normalizado, pero las posiciones de lectura sin procesar no cruzan la frontera.

La respuesta debe contener exactamente la versión 1, el mismo fingerprint y una lista densa de IDs de afirmaciones. Se rechazan arrays heredados, fingerprints de otra solicitud, versiones desconocidas, propiedades adicionales, getters, IDs duplicados y candidatos no autorizados. Los IDs se vuelven a reconciliar con el conjunto local y el texto se reconstruye desde el registro editorial aprobado.

El fingerprint sirve para correlación y frescura, no como autenticación del proveedor. La autoridad narrativa, el control N+1, la verificación de edición y la procedencia continúan siendo locales. Un adaptador nuevo debe devolver el sobre versionado y no puede convertir el fingerprint en un permiso.
