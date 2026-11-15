# Provider Contract

Hoid IA trata al modelo o proveedor como un componente intercambiable. Un proveedor no recibe el catálogo completo ni progreso que pueda usar para inferir contenido futuro: recibe únicamente la pregunta y la evidencia que ya ha superado las capas de admisión.

## Contrato

`HoidProvider` produce un borrador con:

- texto;
- identificadores de la evidencia utilizada.

`executeProviderSafely` aplica una frontera de fallo cerrado:

1. sin pregunta o evidencia autorizada, no se llama al proveedor;
2. una salida vacía se rechaza;
3. una salida sin procedencia se rechaza;
4. cualquier identificador ajeno a la evidencia autorizada rechaza el borrador completo.

La abstención es estructurada y no se sustituye por conocimiento general del proveedor.

Esta capa no almacena extractos protegidos. Las entradas de evidencia contienen identificadores y resúmenes originales previamente autorizados. La existencia de una obra en el catálogo privado no concede conocimiento narrativo; si un pasaje no está accesible, no puede presentarse como consultado.
