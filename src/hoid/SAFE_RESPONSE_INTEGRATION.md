# Integración de respuestas estructuradas

## Objetivo

La salida de un proveedor es una propuesta no confiable. La frontera verifyHoidResponse permite adoptar proveedores que devuelvan afirmaciones estructuradas sin convertir al proveedor en una autoridad de spoilers.

## Secuencia obligatoria

1. El núcleo valida la pregunta y fija una instantánea del progreso.
2. El catálogo autoriza conocimiento por obra y capítulo.
3. La recuperación local selecciona únicamente registros editoriales autorizados.
4. El proveedor recibe contexto mínimo y propone una lista de afirmaciones.
5. Cada afirmación debe referenciar identificadores de evidencia entregados por el núcleo; el proveedor no puede inventar nuevos identificadores.
6. verifyHoidResponse conserva solo afirmaciones con evidencia autorizada.
7. El runtime reconcilia la selección con el registro de afirmaciones aprobadas.
8. createHoidVerifiedAnswerPresenter reconstruye texto, segmentos y citas desde los registros locales y vuelve a comprobar los umbrales de lectura.
9. La interfaz muestra exclusivamente el resultado status: "ready" de esa frontera.

## Regla de no ampliación

El conjunto de acceptedEvidenceIds debe ser subconjunto del conjunto autorizado antes de la llamada al proveedor. Un proveedor, un timeout o una respuesta parcialmente válida nunca pueden ampliar ese conjunto.

Los IDs de afirmación tampoco bastan por sí solos: deben pertenecer al registro aprobado local y su texto, evidencias y citas se reconstruyen desde ese registro.

## Compatibilidad

El contrato histórico HoidProvider devuelve texto y continúa protegido por HoidService. La migración a propuestas estructuradas debe hacerse mediante un adaptador explícito, no reinterpretando texto libre como evidencia. Hasta que ese adaptador exista, una respuesta textual no debe recibir evidencia implícita.

## Fallo conservador

- propuesta malformada: abstención;
- evidencia desconocida: se descarta la afirmación;
- propuesta mixta: solo sobrevive la parte respaldada;
- afirmación no aprobada o alterada: se retiene la respuesta;
- evidencia aún bloqueada: se retiene la respuesta completa;
- ninguna afirmación respaldada: bloqueo o abstención según el estado estructural.

presentHoidEvidenceAnswer es la comprobación estructural de bajo nivel. Para fronteras que reciben objetos externos, debe usarse la fábrica createHoidVerifiedAnswerPresenter, construida exclusivamente desde los registros locales de conocimiento y afirmaciones aprobadas. No debe renderizarse el texto del proveedor ni el objeto de respuesta sin pasar por esa autoridad.

Este documento describe contratos y flujo de integración. No contiene pasajes de las obras ni convierte la bibliografía privada en contenido distribuible.
