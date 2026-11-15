# Contrato de proveedores de Hoid IA

## Objetivo

Esta frontera desacopla la generación de respuestas del proveedor concreto y
mantiene la prevención de spoilers fuera del modelo generativo.

Un proveedor solo recibe:

- la pregunta;
- el modo de respuesta;
- una obra concreta;
- el límite de capítulo ya autorizado;
- resúmenes originales previamente autorizados.

No recibe el catálogo completo ni texto íntegro de EPUBs privados.

## Contrato

`HoidProvider` puede implementarse con cualquier SDK o servicio. La política de
seguridad no depende del proveedor.

Cada afirmación devuelta debe declarar los identificadores de evidencia que la
respaldan. `validateProviderResponse` comprueba que esos identificadores estén
en el conjunto exacto de evidencia autorizada y dentro del progreso.

## Fallo cerrado

La respuesta se rechaza cuando falta evidencia, una afirmación está vacía o se
referencia evidencia futura o desconocida. Una capa superior debe convertir ese
resultado en abstención o pedir una reformulación segura; nunca debe completar
el contenido con conocimiento narrativo no autorizado.

## Copyright

Este contrato trabaja con metadatos, identificadores y resúmenes originales. No
autoriza copiar, almacenar ni subir texto íntegro protegido de las fuentes
privadas.
