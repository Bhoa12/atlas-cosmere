# Hoid IA — Prueba de frontera de conocimiento

La frontera de conocimiento es una capacidad por solicitud, no un catálogo narrativo.

## Invariantes comprobados

- Los identificadores duplicados se reducen a una única capacidad.
- Un identificador desconocido no queda autorizado.
- Las referencias de salida conservan únicamente identificadores ya autorizados.
- Un capítulo inválido provoca rechazo, no una corrección silenciosa.
- La lista expuesta para inspección es una instantánea congelada; mutarla no puede crear una nueva autorización.

## Garantía de spoilers

Este módulo **no decide qué evidencia debe autorizarse**: esa decisión corresponde a las capas anteriores de progreso y presupuesto de contexto. Su única función es preservar la decisión ya tomada y evitar que un proveedor o una capa posterior amplíe el conjunto durante la misma solicitud.

El contrato contiene solamente metadatos estructurales e identificadores. No incorpora texto de los EPUB privados ni convierte una obra presente en el catálogo en evidencia narrativa.
