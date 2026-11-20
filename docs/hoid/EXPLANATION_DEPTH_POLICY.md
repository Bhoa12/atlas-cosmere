# Hoid IA — política de profundidad de explicaciones

## Propósito

La profundidad solicitada adapta la extensión y la estructura de una explicación sin ampliar el conocimiento narrativo autorizado. Es una política determinista, independiente del proveedor y aplicada después de la presentación con procedencia y del control de progreso.

Los niveles disponibles son:

- `brief`: respuesta concisa, hasta 3 afirmaciones, 4 evidencias, 2 obras y 6.000 caracteres.
- `detailed`: explicación desarrollada, hasta 8 afirmaciones, 12 evidencias, 4 obras y 18.000 caracteres.
- `comparative`: análisis comparativo, hasta 12 afirmaciones, 16 evidencias, 4 obras y 24.000 caracteres.

Los límites son máximos, no objetivos. Una respuesta más corta es válida. Los tres niveles exigen procedencia explícita por afirmación: cada segmento visible debe conservar su ID de claim y sus IDs de evidencia exactos.

## Orden obligatorio de validación

1. `presentHoidEvidenceAnswer()` canonicaliza la respuesta.
2. Comprueba el contrato de afirmaciones y la correspondencia exacta entre claims, evidencias y citas.
3. Revalida cada fuente contra el manifiesto de edición y el progreso vivo de la obra correspondiente.
4. Solo si la presentación está autorizada se calcula el presupuesto del nivel solicitado.
5. Se devuelve la presentación original o se retiene el resultado completo.

La política nunca se ejecuta como sustituto del control de spoilers. Tampoco interpreta la profundidad como permiso para consultar más capítulos.

## Integración con la selección de afirmaciones

El gateway convierte el nivel elegido en un `selectionBudget` cerrado y lo propaga por la fachada de cursores hasta `HoidEvidenceRuntime`. El selector recibe únicamente esos límites junto con los candidatos que ya han superado la autorización local. No recibe el valor de profundidad como permiso narrativo ni puede elevar los límites.

El runtime vuelve a imponer el presupuesto después de la selección: número de afirmaciones, evidencias, obras distintas, caracteres y procedencia por afirmación en los tres niveles. Para comparaciones añade el mínimo de obras y una afirmación con evidencias de varias obras. Una selección que excede cualquier límite se rechaza completa. La capa `presentHoidExplanation()` repite la validación después de comprobar las citas y los umbrales de lectura.

La interfaz permite elegir Breve, Detallada o Comparativa. La elección es una preferencia de presentación efímera; no se persiste como progreso ni modifica el estado editorial.

## Procedencia obligatoria por afirmación

`brief`, `detailed` y `comparative` requieren `segments` y `layout` validados. Cada segmento debe corresponder, en el mismo orden, a una afirmación aprobada y enumerar exactamente sus evidencias. La capa de presentación reconstruye las citas de cada segmento desde el manifiesto de evidencias; no acepta texto libre del proveedor ni permite que una afirmación herede citas de otra. Si falta el mapa claim-to-evidence, la respuesta completa se retiene con `segment-provenance-required`.

El runtime local construye los segmentos a partir de los IDs seleccionados y del registro editorial aprobado. El selector externo nunca aporta ni reescribe el texto de las afirmaciones.

## Requisitos comparativos

El nivel `comparative` exige:

- procedencia por segmento;
- evidencias autorizadas de al menos dos obras distintas;
- al menos un segmento cuya afirmación esté vinculada a evidencias de dos o más obras;
- correspondencia exacta entre los identificadores de evidencia declarados y los citados.

No basta con que una respuesta mencione dos obras en segmentos independientes. La afirmación comparativa debe tener procedencia cruzada explícita.

## Comportamiento ante excesos o incertidumbre

La política no recorta, resume, reordena ni reescribe afirmaciones. Si se excede cualquier límite, se retiene la respuesta completa con `depth-budget-exceeded`.

Si una comparación carece de procedencia cruzada suficiente, se retiene con `comparison-provenance-required`.

Si una fuente está bloqueada por el progreso, prevalece el resultado de `presentHoidEvidenceAnswer()`; el nivel de detalle nunca puede desbloquearla.

## Límite del proveedor

El módulo `explanationDepth.ts` no importa SDKs, clientes HTTP, claves, modelos ni tipos de proveedores. Recibe una respuesta ya estructurada y validada, y devuelve un resultado tipado e inmutable. La política no genera prosa ni autoriza contenido.

Un futuro adaptador de proveedor puede usar los presupuestos para planificar una respuesta, pero la validación local posterior seguirá siendo obligatoria.

## Pruebas

`explanationDepth.test.ts` cubre:

- aceptación de una respuesta breve con procedencia exacta por afirmación;
- retención de respuestas breves y detalladas que omiten el mapa claim-to-evidence;
- verificación de que los tres presupuestos exigen procedencia por segmento;
- explicación detallada con varias obras ya autorizadas;
- rechazo completo de respuestas que exceden el presupuesto;
- requisito de procedencia cruzada para comparaciones;
- rechazo de comparaciones con obras separadas por segmentos sin una afirmación compartida;
- conservación del bloqueo de una fuente futura;
- rechazo de niveles no admitidos sin filtrar el texto de respuesta.

## Privacidad y bibliografía

La política solo usa identificadores de obras, capítulos, localizadores y resúmenes editoriales originales ya autorizados. No lee EPUBs, no copia XHTML ni envía texto protegido a proveedores.
