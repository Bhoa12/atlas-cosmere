# Procedencia de respuestas de Hoid IA

Esta capa es la última barrera de procedencia antes de presentar una explicación al lector.

## Contrato

Cada afirmación debe declarar uno o más identificadores de evidencia. La evidencia solo es válida si ya ha sido autorizada por las capas anteriores y cumple estas condiciones:

- tiene identificador no vacío;
- está marcada como accesible;
- pertenece a una estructura de capítulo válida;
- dispone de un resumen original no vacío.

La capa **no** lee EPUBs, no recupera texto protegido y no decide qué capítulos puede conocer el lector. Esas decisiones corresponden al progreso y al alcance narrativo.

## Fallo cerrado

Si una sola afirmación carece de evidencia o referencia un identificador no autorizado, se rechaza el conjunto completo y el resultado es una abstención estructurada. No se intenta completar la respuesta con conocimiento general de un proveedor.

## Desacoplamiento

El módulo no depende de OpenAI, Anthropic, un SDK concreto ni una base de datos. Un proveedor puede generar candidatos, pero la procedencia se verifica mediante este contrato independiente.

## Copyright y fuentes privadas

Los identificadores y resúmenes originales no sustituyen al texto de las obras. No debe almacenarse ni subirse texto íntegro protegido como parte de este componente. Si un pasaje no está accesible, no puede convertirse en evidencia válida.
