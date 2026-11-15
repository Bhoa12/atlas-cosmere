# Contrato de recomendaciones seguras

Las recomendaciones de Hoid IA pueden orientar al lector, pero no constituyen una excepción a la frontera anti-spoilers.

## Regla de admisión

Cada recomendación debe:

1. contener texto propio y no vacío;
2. declarar al menos una evidencia;
3. usar exclusivamente identificadores de evidencia que ya hayan sido admitidos por el contexto seguro.

La verificación es **atómica**: si un único consejo usa evidencia no autorizada, se rechaza la recomendación completa. No se conserva una parte aparentemente segura, porque la redacción del conjunto podría depender de conocimiento futuro.

## Separación de responsabilidades

Este contrato no recupera EPUBs ni decide qué capítulos son seguros. Recibe únicamente identificadores de evidencia que han superado las capas anteriores:

**catálogo → progreso → alcance → procedencia → contexto autorizado → recomendación → verificación atómica**.

La bibliografía privada se utiliza como catálogo de fuentes y estructura de lectura. Este contrato no almacena ni reproduce pasajes protegidos. Si no existe evidencia accesible y autorizada para sostener un consejo, Hoid IA debe abstenerse de presentarlo como recomendación basada en la lectura.
