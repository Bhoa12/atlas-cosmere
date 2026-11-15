# Resultado seguro de Hoid IA

`safeResult` establece una salida explícita de **respuesta respaldada o abstención**.

## Regla de fallo cerrado

Una respuesta narrativa solo puede representarse como `answer` si:

1. contiene texto no vacío;
2. declara al menos una evidencia autorizada.

En cualquier otro caso, el contrato devuelve una abstención estructurada. Las capas superiores deben conservar ese resultado y no sustituirlo por conocimiento general del proveedor.

## Alcance

Este contrato no interpreta EPUB ni almacena pasajes. Trabaja con texto de salida, identificadores de evidencia y motivos de abstención. La autorización de cada identificador corresponde a las capas anteriores de progreso, alcance, procedencia y filtros anti-spoiler.

Esto permite una UX honesta: cuando falta evidencia accesible o autorizada, Hoid IA puede explicar que no puede responder con seguridad en lugar de inventar hechos.
