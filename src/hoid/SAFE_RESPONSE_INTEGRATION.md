# Integración de respuestas estructuradas

## Objetivo

La salida de un proveedor es una propuesta no confiable. La frontera verifyHoidResponse permite adoptar proveedores que devuelvan afirmaciones estructuradas sin convertir al proveedor en una autoridad de spoilers.

## Secuencia obligatoria

1. El núcleo valida la pregunta y fija una instantánea del progreso.
2. El catálogo autoriza conocimiento por obra y capítulo.
3. La recuperación local selecciona únicamente registros editoriales autorizados.
4. El proveedor recibe contexto mínimo y propone una lista de identificadores de afirmaciones y evidencias.
5. Cada identificador debe pertenecer al conjunto autorizado antes de la llamada; el proveedor no puede inventar evidencia.
6. verifyHoidResponse valida la forma de la propuesta.
7. El runtime reconcilia la selección con el registro de afirmaciones aprobadas.
8. createHoidVerifiedAnswerPresenter reconstruye texto, segmentos y citas desde los registros locales y vuelve a comprobar los umbrales de lectura.
9. Para producción, createHoidTrustedVerifiedAnswerPresenter exige además firmas Ed25519 verificadas contra una raíz fijada por el host y un trust registry cuya revisión mínima esté persistida de forma durable.
10. La interfaz muestra exclusivamente el resultado status: "ready" de la autoridad criptográfica y estructural.

## Regla de no ampliación

El conjunto de acceptedEvidenceIds debe ser subconjunto del conjunto autorizado antes de la llamada al proveedor. Un proveedor, un timeout o una respuesta parcialmente válida nunca pueden ampliar ese conjunto.

Los IDs de afirmación tampoco bastan por sí solos: deben pertenecer al registro aprobado local y su texto, evidencias y citas se reconstruyen desde ese registro. La integridad SHA-256 no autentica al revisor.

## Compatibilidad

El contrato histórico HoidProvider devuelve texto y continúa protegido por HoidService. La migración a propuestas estructuradas debe hacerse mediante un adaptador explícito, no reinterpretando texto libre como evidencia. Hasta que ese adaptador exista, una respuesta textual no debe recibir evidencia implícita.

## Fallo conservador

- propuesta malformada: abstención;
- evidencia desconocida: se descarta la afirmación;
- propuesta mixta: solo sobrevive la parte respaldada;
- afirmación no aprobada, firma ausente o alterada: se retiene la respuesta;
- evidencia aún bloqueada: se retiene la respuesta completa;
- bootstrap, registro de confianza o almacén de revisión no disponibles: se retiene la respuesta;
- ninguna afirmación respaldada: bloqueo o abstención según el estado estructural.

presentHoidEvidenceAnswer es la comprobación estructural de bajo nivel. createHoidVerifiedAnswerPresenter reconstruye la respuesta desde los registros locales; createHoidTrustedVerifiedAnswerPresenter añade la autenticidad criptográfica requerida para producción. No debe renderizarse el texto del proveedor ni el objeto de respuesta sin pasar por ambas autoridades.

La promoción editorial conserva su gate separado: recibos completos, firmas por paquete, número mínimo de revisores, revisión de GitHub y progreso autorizado. Una firma individual no sustituye ese proceso.

Este documento describe contratos y flujo de integración. No contiene pasajes de las obras ni convierte la bibliografía privada en contenido distribuible.


## Autoridad del progreso en la presentación final

createHoidTrustedVerifiedAnswerPresenter no acepta un snapshot de progreso como argumento de present. Lee el cursor vigente mediante el puerto local readProgressSnapshot, inyectado por el host desde el almacén autoritativo (por ejemplo, SQLite). El proveedor y la interfaz no pueden suministrar un cursor alternativo ni adelantar el capítulo para desbloquear evidencia.

Si la lectura del progreso falla, el snapshot es inválido, cambia la revisión de confianza o caduca el bootstrap/registro, la presentación se retiene. El adaptador del host debe leer una instantánea coherente y validada del almacén local; no debe derivarla de parámetros de la petición ni de la salida del proveedor.
