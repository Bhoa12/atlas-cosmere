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

## Cancelación cooperativa y resultados tardíos

El selector recibe un contexto de invocación separado del payload narrativo:

- `signal`: AbortSignal propiedad del runtime para esa llamada concreta.

El objeto de invocación también es un snapshot cerrado: debe estar congelado, tener únicamente la propiedad de datos enumerable `signal` y no contener getters ni campos adicionales. El adaptador comprueba la señal mediante el getter nativo de `AbortSignal.prototype`, que realiza la validación de marca; no lee `context.signal` mediante una propiedad potencialmente accesoria. Se rechazan señales simuladas y contextos mutables antes de despachar el transporte.

El runtime inicia la operación únicamente después de instalar el deadline y los listeners de cancelación. Si vence el timeout o el llamante cancela la consulta, aborta la señal y cierra la invocación con un resultado tipado. La cancelación del llamante se presenta como `request-cancelled`; el timeout o el fallo del adaptador se presentan como indisponibilidad del proveedor.

Los adaptadores HTTP deben transmitir la señal a su transporte cuando este admita cancelación. Si un adaptador ignora la señal, Hoid no puede garantizar que el trabajo remoto se detenga físicamente; sí garantiza que una resolución posterior queda fuera de la ruta de presentación y no puede autorizar ni mostrar una respuesta tardía.

La señal no contiene progreso, permisos, claims ni texto narrativo. Cancelar una consulta no modifica el cursor, el fingerprint de lectura ni las autorizaciones editoriales.

## Fábrica de adaptadores de referencia

`src/hoid/providerAdapter.ts` expone `createHoidClaimSelectorAdapter(transport)`. La fábrica:

- acepta solo el snapshot v1 congelado y con claves exactas;
- rechaza solicitudes mutables o con campos extra antes del transporte;
- vuelve a comprobar `signal.aborted` en la microtarea de despacho;
- entrega al transporte la misma señal y un contexto de invocación congelado;
- no incorpora SDKs ni interpreta la respuesta como autoridad narrativa.

El transporte sigue siendo responsable de pasar la señal al cliente HTTP/SDK. La fábrica es una frontera de conformidad, no una autenticación ni un sustituto de `parseHoidClaimSelectionResponse()` en el runtime.

## Conformidad reutilizable, repetición e idempotencia

`src/hoid/providerAdapterConformance.testkit.ts` ofrece una batería de comportamiento reutilizable para fábricas de adaptadores. Comprueba el forwarding del snapshot inmutable, el rechazo previo al despacho, la validación del contexto, la cancelación previa y activa, y el tratamiento de errores de transporte. Un adaptador específico puede ejecutar la misma suite pasando su fábrica y su puente de transporte, sin introducir su SDK en el dominio.

El adaptador de referencia realiza como máximo un despacho de transporte por invocación. El núcleo no aplica reintentos automáticos: un error de transporte no se interpreta como prueba de que el servidor remoto no procesó la solicitud. Las invocaciones explícitas repetidas conservan el mismo payload y fingerprint cuando la pregunta, el progreso, el presupuesto y los candidatos son idénticos.

El fingerprint es una clave de correlación, no una garantía de idempotencia remota ni una autorización para reproducir respuestas. Si un adaptador futuro implementa reintentos, debe documentar el comportamiento de idempotencia del proveedor, reutilizar exactamente el mismo snapshot, respetar el deadline y la señal originales, y no reintentar tras cancelación, timeout o una respuesta ya recibida. La respuesta final seguirá pasando por el parser local y por la reconciliación de IDs.


## Ámbito explícito por obra

La solicitud estricta puede incluir un ámbito local `bookScope` opcional con dos formas: `single-work` (una obra) o `cross-work` (entre dos y cuatro obras conocidas). El contrato se canonicaliza mediante IDs del catálogo, rechaza duplicados, getters, propiedades extra y obras desconocidas, y ordena los IDs para obtener una representación determinista.

El ámbito solo restringe. No desbloquea evidencia, no sustituye el progreso y no se envía como permiso al proveedor. Antes de construir candidatos, Hoid exige que toda la evidencia de cada afirmación pertenezca al ámbito y que cada fuente haya superado por separado su `evidenceUnlock`. En un ámbito `cross-work`, el conjunto final seleccionado debe aportar evidencia de todas las obras solicitadas; si falta una, la respuesta se retiene.

El ámbito se incorpora al fingerprint de la solicitud de selección para impedir que una selección de otra pregunta, progreso o alcance se reutilice. El proveedor sigue recibiendo únicamente candidatos ya autorizados y puede devolver únicamente sus IDs. La reconciliación y la cobertura final se vuelven a comprobar localmente.
