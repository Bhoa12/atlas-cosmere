# Hoid IA — Verificación estructurada de respuestas

Una respuesta de proveedor es una propuesta no confiable. Esta frontera introduce un contrato estructurado de **afirmaciones con evidencia** para que la presentación final dependa de conocimiento previamente autorizado.

## Regla

Cada afirmación debe incluir al menos un identificador de evidencia que ya haya superado:

1. catálogo canónico;
2. progreso validado por obra y capítulo;
3. autorización editorial y procedencia.

La frontera no consulta EPUBs ni almacena pasajes privados. Trabaja únicamente con identificadores y texto generado por el proveedor.

## Resultados

- `authorized`: todas las afirmaciones tienen evidencia autorizada.
- `limited`: se conservan únicamente las afirmaciones respaldadas.
- `blocked`: existían afirmaciones, pero ninguna podía respaldarse.
- `abstain`: la propuesta era ausente, malformada o estructuralmente inválida.

Un lote sobredimensionado falla de forma cerrada. Una afirmación sin evidencia nunca se muestra como contenido narrativo.

## Integración

Los adaptadores de proveedores pueden transformar una respuesta externa al contrato `HoidResponseProposal`, pero no deben decidir la autorización. La evidencia aceptada procede exclusivamente del núcleo local.

Esto refuerza la propiedad de no ampliación: el proveedor puede reformular conocimiento autorizado, pero no introducir una afirmación que carezca de evidencia autorizada.
