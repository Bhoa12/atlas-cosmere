# Hoid IA: contrato ejecutable de proveedores

## Propósito

Este contrato convierte la frontera conceptual de proveedores en una API local y verificable.

Un proveedor recibe únicamente:

- la pregunta del lector;
- identificadores de evidencia que ya han sido autorizados.

Un proveedor devuelve un borrador compuesto por afirmaciones separables. Cada afirmación debe referenciar evidencia mediante identificadores.

## Regla de verificación

`verifyProviderDraft` aplica una frontera de fallo cerrado:

- una afirmación vacía se descarta;
- una afirmación sin evidencia se descarta;
- una afirmación que cite un identificador no autorizado se descarta;
- el proveedor no puede registrar un nuevo identificador como autorizado.

El resultado verificado es inmutable para evitar ampliaciones posteriores del contexto.

## Independencia

La interfaz `HoidProvider` no depende de un SDK concreto. Un adaptador de OpenAI, un modelo local o cualquier otro proveedor puede implementar la interfaz sin modificar las políticas de progreso, catálogo o spoilers.

## Fuentes privadas

Los identificadores de evidencia no contienen texto íntegro de los EPUB privados. El contrato no autoriza a transferir una obra completa a un proveedor. La selección de contenido y su disponibilidad siguen siendo responsabilidad de las capas anteriores.

Si no existe evidencia autorizada suficiente, la capa de respuesta debe limitarse o abstenerse.
