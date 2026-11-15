# Contrato de afirmaciones de Hoid IA

## Objetivo

Una respuesta puede contener varias afirmaciones narrativas. Este contrato exige que
cada afirmación se declare separadamente y que cite identificadores de evidencia ya
autorizados para la consulta actual.

## Reglas

- El texto de una afirmación no puede estar vacío.
- Cada afirmación debe declarar al menos una evidencia.
- Todas las evidencias deben pertenecer al conjunto autorizado.
- Los identificadores se normalizan y se eliminan duplicados.
- La verificación es atómica: una afirmación no respaldada invalida el conjunto.

## Límites

El contrato no decide si una evidencia es verdadera ni recupera texto de fuentes
privadas. Solo conserva la frontera de procedencia que las capas anteriores hayan
establecido mediante progreso de lectura, obra, capítulo y accesibilidad.

Si no hay afirmaciones suficientemente respaldadas, el resultado es una abstención
estructurada. Esta abstención debe propagarse a la capa final en lugar de completarse
con conocimiento general del proveedor.
