# Presentación verificada de respuestas

## Propósito

presentHoidEvidenceAnswer valida la forma de una respuesta, sus citas, el manifiesto de lectura y el umbral de desbloqueo. No recibe por sí sola el registro local de afirmaciones aprobadas; por tanto, debe tratarse como una frontera estructural de bajo nivel, no como la única autoridad para una integración que acepte objetos externos.

createHoidVerifiedAnswerPresenter añade autoridad local de integridad y reconstrucción.

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
- Los hashes detectan alteraciones, pero no son firmas digitales ni autentican por sí solos la identidad del revisor.
- La fábrica valida autorización y procedencia, no la pertinencia semántica respecto de la pregunta.

## Autoridad criptográfica para producción

La fábrica anterior es una frontera de integridad, no una prueba de identidad editorial. Un reviewerId y una atestación SHA-256 pueden ser recreados por código; no deben bastar para habilitar conocimiento de producción.

Las integraciones de producción deben construir createHoidTrustedVerifiedAnswerPresenter desde el host confiable. Esta segunda frontera exige:

- bootstrap con raíz pública fijada fuera de banda;
- trust registry Ed25519 vigente y autorizado para el repositorio;
- revisión mínima persistida en un almacén durable y resistente a rollback;
- firma Ed25519 por cada afirmación y contexto exacto de revisión;
- invalidación si cambia el bootstrap, la revisión persistida o la caducidad.

La promoción del paquete editorial conserva además sus propios requisitos de recibos, múltiples revisores y revisión de GitHub. La verificación de una firma individual no sustituye ese gate.

## Integración

Construir la autoridad desde registros y configuración local del host, nunca desde una respuesta del proveedor. No renderizar answer.text, answer.sources ni answer.segments directamente. La interfaz solo puede mostrar el resultado ready de la autoridad criptográfica y estructural, con el snapshot de progreso vigente.

La ausencia de un registro aprobado, una firma, una huella de capítulo, un bootstrap o un estado de confianza inequívoco debe producir abstención.

La configuración real de confianza, la clave raíz, las claves privadas de revisores y el almacén anti-rollback deben permanecer fuera de la aplicación lectora. No se incluyen claves privadas ni secretos en el repositorio.
