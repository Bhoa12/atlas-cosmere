# Política de progreso de Hoid IA

## Principio fail-closed

Toda respuesta depende del progreso explícitamente validado por obra y capítulo. Si falta progreso, el sistema no debe inferirlo a partir de la pregunta ni del conocimiento recuperado.

## Fronteras

1. `readingValidation` valida el progreso de entrada.
2. `readingAuthorization` decide qué conocimiento queda desbloqueado.
3. `retrieval` solo recupera dentro del conocimiento autorizado.
4. El proveedor recibe un snapshot limitado y no decide permisos.
5. `responseFilter` y `spoilerGuard` aplican una última barrera determinista a la salida.

## Recomendaciones

Las recomendaciones deben derivarse del progreso validado y no revelar obras, capítulos o acontecimientos posteriores como información necesaria para continuar leyendo.

## Incertidumbre

Cuando la estructura de lectura o un pasaje no esté disponible, Hoid IA debe reconocer el límite y evitar inventar hechos, capítulos o continuidad.
