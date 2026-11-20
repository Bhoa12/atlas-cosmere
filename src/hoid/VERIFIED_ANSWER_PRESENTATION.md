# Presentación verificada de respuestas

## Propósito

presentHoidEvidenceAnswer valida la forma de una respuesta, sus citas, el manifiesto de lectura y el umbral de desbloqueo. No recibe por sí sola el registro local de afirmaciones aprobadas; por tanto, debe tratarse como una frontera estructural de bajo nivel, no como la única autoridad para una integración que acepte objetos externos.

createHoidVerifiedAnswerPresenter añade esa autoridad local.

## Construcción

La fábrica recibe exclusivamente los registros locales knowledge y claims. Rechaza la configuración si:

- los arrays son dispersos, contienen accesores o tienen identificadores duplicados;
- una afirmación no supera validateHoidApprovedClaimAttestation;
- alguna evidencia no está vinculada a un documento de capítulo verificado;
- una afirmación referencia evidencia ausente;
- una cita no puede reconstruirse desde el registro de conocimiento.

La fábrica conserva copias canónicas e inmutables de las afirmaciones aprobadas y de sus citas. No conserva el proveedor ni recibe texto de EPUB.

## Presentación

El resultado del runtime se interpreta como una lista de identificadores seleccionados, no como autoridad sobre el texto. Antes de mostrar nada, la frontera:

1. exige identificadores de afirmaciones presentes en el registro aprobado;
2. conserva el orden editorial del registro local;
3. reconstruye el texto exacto desde las afirmaciones aprobadas;
4. reconstruye la unión de evidencias y las citas desde el registro local;
5. comprueba que cada segmento mantiene su asignación exacta de afirmación y evidencia;
6. delega la última comprobación de progreso y desbloqueo a presentHoidEvidenceAnswer.

El texto, las citas o los segmentos suministrados por un proveedor no se muestran si difieren del registro local. Las respuestas blocked y abstain se convierten en una abstención de presentación sin repetir su texto interno.

## Garantías y límites

- Una afirmación aprobada no se muestra antes de que se alcance el umbral de cada evidencia.
- El progreso de una obra no desbloquea otra.
- Un proveedor no puede inventar un ID, reescribir una afirmación ni sustituir su cita.
- Los datos de configuración se validan y se copian al crear la fábrica; mutaciones posteriores del llamador no cambian el resultado.
- Los hashes de integridad detectan alteraciones, pero no son firmas digitales ni autentican por sí solos la identidad del revisor.
- La fábrica valida autorización y procedencia, no la pertinencia semántica respecto de la pregunta. La selección de afirmaciones sigue siendo responsabilidad del runtime local.

## Integración obligatoria

Construir la fábrica desde los registros locales de producción, nunca desde una respuesta del proveedor. Pasar a present únicamente el resultado del runtime y el snapshot de progreso vigente. No renderizar directamente answer.text, answer.sources ni answer.segments antes de que la presentación devuelva status ready.

La ausencia de un registro aprobado, de una huella de capítulo o de una posición inequívoca debe producir abstención. No se infieren capítulos, relaciones ni pasajes ausentes.
