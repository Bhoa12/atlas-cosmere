# Política de ámbito explícito por obra

## Objetivo

Mantener el contexto de una respuesta dentro de la obra o conjunto de obras que el lector ha solicitado, sin convertir esa selección en una autorización narrativa.

## Contrato

`bookScope` es opcional y solo admite registros planos cerrados:

- `{ mode: "single-work", bookIds: [bookId] }`: una obra conocida.
- `{ mode: "cross-work", bookIds: [bookIdA, bookIdB, ...] }`: entre dos y cuatro obras conocidas.

Los IDs deben existir en la bibliografía, ser únicos y estar expresados como datos propios enumerables. Se rechazan getters, símbolos, propiedades adicionales, arrays dispersos, IDs desconocidos y combinaciones de modo y cardinalidad incompatibles.

## Orden de aplicación

1. Validar la pregunta y el progreso por obra/cursor.
2. Canonicalizar el ámbito explícito.
3. Recuperar únicamente evidencias con procedencia verificada y desbloqueo alcanzado en su propia obra.
4. Filtrar las afirmaciones: todas sus evidencias deben permanecer dentro del ámbito.
5. En `cross-work`, comprobar antes del proveedor que existe evidencia autorizada en cada obra solicitada.
6. Enviar al selector solo los candidatos ya autorizados.
7. Reconciliar los IDs seleccionados con los candidatos locales.
8. Exigir que la respuesta final cubra todas las obras del ámbito y ninguna ajena.
9. Reconstruir el texto y las citas desde el registro editorial local.

## Presupuesto

El presupuesto `minimumWorks` se endurece al menos al número de obras declaradas. Si `maxWorks` no permite cubrir el ámbito, o el presupuesto exige más obras de las declaradas, la solicitud se rechaza antes del proveedor. No se recortan evidencias para forzar una respuesta.

## Frontera del proveedor

El ámbito canónico se incorpora al fingerprint de la solicitud de selección. No se envía como permiso, ni transporta progreso bruto. El proveedor sigue recibiendo candidatos ya autorizados y solo puede devolver sus IDs. El fingerprint es correlación/frescura, no autenticación.

## Reglas de abstención

Hoid se abstiene cuando una obra solicitada no tiene evidencia desbloqueada suficiente, cuando el selector devuelve una selección unilateral para una comparación o cuando la evidencia excede el ámbito. Nunca sustituye la obra ausente por conocimiento general del modelo.

## Privacidad y propiedad intelectual

El ámbito contiene únicamente IDs de bibliografía. No incorpora EPUBs, XHTML, texto extraído, rutas privadas ni contenido protegido.


## Integración de selección en HoidScreen

La pantalla expone tres modos temporales:

- **Automático:** no envía un ámbito explícito; se conserva el comportamiento general con autorización independiente por obra.
- **Una obra:** exige exactamente un ID del catálogo.
- **Comparar 2–4:** exige entre dos y cuatro IDs únicos del catálogo.

La selección se mantiene solo en memoria de pantalla. Cambiar el modo o las obras seleccionadas borra los contextos conversacionales tipados y reinicia el hilo visible para impedir que un seguimiento reutilice una respuesta generada bajo otro ámbito. No se escribe la selección en SQLite ni se guarda como preferencia permanente.

El adaptador de selección es puro (answerScopeSelection.ts) y produce el mismo contrato cerrado que valida el runtime. La interfaz no concede permisos: una obra seleccionada sin evidencia desbloqueada sigue sin producir respuesta.

## Propagación por el gateway conversacional

HoidConversationGateway valida y canonicaliza bookScope antes de resolver referencias o invocar el runtime. La selección canonicalizada se propaga por las rutas de entidad única, seguimiento tipado, seguimiento de grupo y consulta general.

Cuando existe un ámbito explícito, las preguntas de relaciones no usan el atajo del grafo local sin ámbito. Se enrutan por el runtime estricto de evidencias para que cada afirmación satisfaga la política de una o varias obras. Sin ámbito explícito, se conserva la ruta local revisada existente.

El ámbito solo se aplica a respuestas narrativas. Las consultas de progreso y las recomendaciones de catálogo siguen sus contratos propios y no se reinterpretan como respuestas narrativas.

## Validación del ámbito en la presentación final

Después de que la autoridad firmada haya validado el texto, las citas y los desbloqueos por capítulo, Hoid vuelve a comprobar que el conjunto de obras citado coincide exactamente con el ámbito seleccionado. Una respuesta de una sola obra no puede contener citas de otra; una comparación debe citar todas las obras seleccionadas y ninguna adicional.

Las comparaciones explícitas requieren además procedencia por segmento. La matriz transversal se reconstruye desde la respuesta validada y el snapshot de progreso de la solicitud, y agrupa únicamente títulos y capítulos. Si falta una obra, una cita no coincide con la bibliografía, el mapeo por segmento no se valida o el conjunto de obras difiere del selector, se retiene toda la comparación; no se presenta una versión parcial.

En modo automático, una respuesta cuyas citas abarcan varias obras también requiere procedencia por segmento completa; si no valida, se retiene la respuesta transversal en lugar de mostrarla parcialmente. Esta comprobación de presentación no sustituye la validación de desbloqueo del presentador firmado ni concede acceso narrativo.
