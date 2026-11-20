# Hoid IA — Run 183: protocolo versionado y respuestas vinculadas a la solicitud

## Objetivo

Evitar que una respuesta tardía, almacenada en caché o reproducida por un adaptador de proveedor se acepte para una pregunta o un snapshot de lectura distintos.

## Hallazgo

El selector devolvía una lista desnuda de IDs. El runtime verificaba que esos IDs pertenecieran al conjunto candidato actual, pero no podía distinguir una selección reciente de una lista reproducida desde otra llamada cuando ambos conjuntos compartían identificadores.

El resultado no podía ampliar permisos narrativos, pero sí podía producir una selección semánticamente obsoleta.

## Cambios

- Se introduce selectionProtocol.ts con el protocolo neutral de selección versión 1.
- Cada solicitud incorpora un fingerprint SHA-256 de la pregunta, intención, presupuesto, candidatos y progreso normalizado por obra.
- El progreso en bruto no se envía al selector; solo se incluye su huella dentro del fingerprint.
- La respuesta exige un sobre exacto con versión, fingerprint coincidente y claimIds.
- Se rechazan respuestas heredadas en forma de array, fingerprints obsoletos, versiones desconocidas, campos extra, accessors, arrays dispersos, IDs duplicados y claims que no pertenecen al conjunto candidato.
- El presupuesto predeterminado también exige procedencia por afirmación.

## Seguridad

El fingerprint es una vinculación de frescura y correlación, no una firma ni autenticación del proveedor. La selección continúa limitada a IDs de candidatos autorizados. Hoid reconstruye localmente el texto y las citas desde los registros editoriales aprobados.

El control de progreso por edición y el desbloqueo N+1 se ejecutan antes de llamar al selector. Un resultado de otra pregunta, intención, presupuesto, candidato o snapshot no puede reutilizarse.

## Pruebas

- Huella determinista y sensible a pregunta, progreso, presupuesto y candidatos.
- Ausencia de posiciones de lectura en el objeto enviado al selector.
- Aceptación de una respuesta con fingerprint coincidente.
- Rechazo de fingerprint obsoleto y de arrays heredados.
- Rechazo de campos extra, getters, versiones no admitidas y IDs duplicados.
- Regresión de replay: una respuesta válida de una primera llamada se rechaza en una segunda llamada con otra pregunta y progreso.
- Integración del protocolo en el runtime de evidencia y la fachada de cursores.

## Privacidad y catálogo

No se han abierto ni inspeccionado EPUBs en esta iteración. No se han añadido hechos narrativos, pasajes, XHTML, imágenes ni rutas privadas. La bibliografía catalogada permanece sin cambios y no se ha afirmado acceso a fuentes nuevas.

No se han modificado el progreso del lector, manifiestos, allowlists de capítulos, resúmenes, revisiones editoriales ni el registro de producción.

## Aislamiento

- Rama: feat/hoid-ia-core-run183.
- Base: feat/hoid-ia-core-run182.
- SHA base: cdffc942130e1e19bcfc3b258e8ba674a633891e.
- La rama es hija del HEAD exacto de Run 182; no actualiza ninguna rama anterior.
- main permanece fuera de esta cadena de cambios.
- El PR de esta iteración se mantiene en borrador y no se fusiona automáticamente.
