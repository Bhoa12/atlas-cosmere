# Hoid IA: pipeline de seguridad

Este módulo integra la última frontera de generación sin acoplar Hoid IA a un proveedor concreto.

## Entrada

La entrada debe haber pasado previamente los contratos de catálogo, progreso, alcance y recuperación. El pipeline vuelve a comprobar sus invariantes mínimos y elimina evidencia fuera del capítulo máximo.

## Proveedor

El proveedor recibe únicamente la pregunta normalizada y resúmenes originales de evidencia autorizada. La interfaz `NarrativeProvider` no contiene credenciales, SDK ni conocimiento global del Cosmere, por lo que un proveedor puede sustituirse sin cambiar la política.

## Salida de fallo cerrado

La salida solo puede ser:

- `answer`: texto no vacío con identificadores que pertenecen al contexto autorizado.
- `abstain`: solicitud inválida, falta de evidencia, fallo del proveedor o borrador no verificable.

Una referencia de evidencia desconocida rechaza el borrador completo. No hay una ruta de respaldo que genere una respuesta narrativa usando conocimiento externo cuando falta evidencia autorizada.

## Copyright y fuentes privadas

Este contrato no almacena pasajes íntegros. La evidencia que recibe debe usar metadatos y resúmenes originales respaldados por una procedencia accesible. Si una fuente privada no está disponible en el entorno, no debe fabricarse evidencia ni afirmarse que se ha consultado.
