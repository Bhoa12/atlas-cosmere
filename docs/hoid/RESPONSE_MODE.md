# Hoid IA: modos de explicación y recomendación

Hoid IA puede adaptar la **forma** de ayudar al lector sin adaptar de forma implícita el conocimiento narrativo disponible.

## Modos

- `explain`: organiza la evidencia autorizada para aclarar una duda.
- `recommend`: propone una siguiente acción de lectura o exploración usando únicamente la misma evidencia autorizada.

El modo no añade obras, capítulos ni hechos al contexto.

## Frontera de seguridad

`buildModeContext` acepta evidencia solo si:

1. pertenece exactamente a la obra solicitada;
2. su capítulo es igual o anterior al progreso autorizado;
3. tiene identificador y resumen original no vacíos.

La evidencia futura, de otra obra o malformada se descarta. Si no queda ninguna evidencia, el resultado es una abstención estructurada.

## Integración

Esta capa está diseñada para situarse antes de un proveedor desacoplado. El proveedor debe recibir exclusivamente la evidencia del contexto listo y no puede utilizar el modo `recommend` como permiso para inferir acontecimientos posteriores.

## Fuentes privadas

El contrato no incorpora texto íntegro de EPUBs. Trabaja con metadatos de obra y capítulo y con resúmenes originales respaldados. Si un pasaje no es accesible, no debe crearse evidencia ni afirmarse que se ha consultado.
