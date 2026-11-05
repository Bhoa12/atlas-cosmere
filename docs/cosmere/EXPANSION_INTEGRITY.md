# Validación integral de la expansión

`validateExpansionIntegrity` comprueba conjuntamente dos capas técnicas:

- la estructura declarada de mundos, obras y unidades;
- los límites del progreso frente a las unidades declaradas.

La función agrega diagnósticos existentes y los conserva separados por capa para que la interfaz pueda mostrarlos o bloquear operaciones de forma explícita.

## Límites deliberados

Esta validación trabaja únicamente con metadatos ya declarados. No lee EPUBs, no crea capítulos o unidades ausentes, no corrige automáticamente IDs y no infiere hechos narrativos ni puntos de desbloqueo.

Por tanto, un catálogo incompleto sigue siendo incompleto: la validación informa del problema sin convertir una suposición en contenido editorial.
