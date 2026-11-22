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
