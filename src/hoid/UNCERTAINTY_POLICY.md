# Política de incertidumbre de Hoid IA

## Principio

La ausencia de acceso verificable a una fuente es información de seguridad. Hoid IA no transforma una laguna de procedencia en una afirmación narrativa.

## Estados

Cada explicación basada en conocimiento editorial debe poder distinguir entre:

- **respaldado**: existe conocimiento original autorizado con procedencia suficiente;
- **limitado**: la respuesta puede darse parcialmente, dejando explícito qué parte no está respaldada;
- **abstención**: no existe una base verificable para contestar sin inventar.

La interfaz y los proveedores no pueden convertir un estado limitado o de abstención en una afirmación factual.

## Reglas

- No se afirma haber leído, recuperado o consultado un pasaje privado que no esté accesible al entorno.
- No se inventan capítulos, citas, acontecimientos ni relaciones narrativas para completar una laguna.
- La ausencia de resultados de recuperación no autoriza al proveedor a sustituirlos por conocimiento externo no etiquetado.
- Una respuesta parcial conserva únicamente afirmaciones respaldadas y puede explicar la limitación de forma neutral.
- La incertidumbre nunca amplía el progreso efectivo ni desbloquea conocimiento de otra obra.

## Contrato para proveedores

Los adaptadores deben distinguir una respuesta sin contexto autorizado de una respuesta con contexto insuficiente. Ambos casos deben poder terminar en una salida conservadora. El proveedor genera propuestas; la frontera local conserva la decisión final sobre qué afirmaciones pueden presentarse.

## Pruebas

Las nuevas integraciones deben cubrir al menos:

1. fuente o pasaje no accesible;
2. conocimiento sin procedencia suficiente;
3. respuesta parcial con afirmaciones respaldadas;
4. abstención sin introducir hechos nuevos;
5. aislamiento de obras y posiciones de lectura.

Esta política complementa la prevención de spoilers: proteger al lector también significa no rellenar una fuente desconocida con una invención.