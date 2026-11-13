# Integración de respuestas estructuradas

## Objetivo

La salida de un proveedor es una propuesta no confiable. La frontera
`verifyHoidResponse` permite adoptar proveedores que devuelvan afirmaciones
estructuradas sin convertir al proveedor en una autoridad de spoilers.

## Secuencia obligatoria

1. El núcleo valida la pregunta y fija una instantánea del progreso.
2. El catálogo autoriza conocimiento por obra y capítulo.
3. La recuperación local selecciona únicamente registros editoriales autorizados.
4. El proveedor recibe contexto mínimo y propone una lista de afirmaciones.
5. Cada afirmación debe referenciar identificadores de evidencia entregados por el
   núcleo; el proveedor no puede inventar nuevos identificadores.
6. `verifyHoidResponse` conserva solo afirmaciones con evidencia autorizada.
7. El resultado estructurado se pasa por las fronteras de presentación y spoilers
   existentes antes de mostrarse.

## Regla de no ampliación

El conjunto de `acceptedEvidenceIds` debe ser subconjunto del conjunto
autorizado antes de la llamada al proveedor. Un proveedor, un timeout o una
respuesta parcialmente válida nunca pueden ampliar ese conjunto.

## Compatibilidad

El contrato histórico `HoidProvider` devuelve texto y continúa protegido por
`HoidService`. La migración a propuestas estructuradas debe hacerse mediante un
adaptador explícito, no reinterpretando texto libre como evidencia. Hasta que ese
adaptador exista, una respuesta textual no debe recibir evidencia implícita.

## Fallo conservador

- propuesta malformada: abstención;
- evidencia desconocida: se descarta la afirmación;
- propuesta mixta: solo sobrevive la parte respaldada;
- ninguna afirmación respaldada: bloqueo o abstención según el estado estructural.

Este documento describe contratos y flujo de integración. No contiene pasajes de
las obras ni convierte la bibliografía privada en contenido distribuible.
