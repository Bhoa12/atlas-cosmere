# Hoid IA: presupuesto de conocimiento ejecutable

`requestKnowledgeBudget.ts` materializa la regla de seguridad principal de Hoid IA: una solicitud obtiene un techo de conocimiento al inicio y las fases posteriores solo pueden reducirlo.

## Entradas

El constructor recibe posiciones de lectura canónicas y registros editoriales. Un registro solo entra en el presupuesto cuando:

- la obra tiene una posición válida para el lector;
- el capítulo máximo del registro no supera esa posición;
- la procedencia está marcada como `verified` u `original_summary`.

Los identificadores son metadatos. El módulo no almacena ni transporta pasajes de EPUB.

## Propiedad monotónica

`narrowKnowledgeBudget` acepta únicamente identificadores que ya estaban autorizados. No existe una operación para añadir evidencia a un presupuesto ya creado.

Esto permite reutilizar el mismo presupuesto en reintentos de proveedor sin consultar de nuevo un progreso mutable.

## Catálogo de fuentes

La bibliografía privada se representa fuera de este módulo mediante identificadores canónicos y estructura de lectura. Incluye las obras verificadas de `cosmere.epub` y los EPUB privados de Roshar aportados por el usuario, pero este contrato no copia texto protegido.

Si una fuente o pasaje no está accesible o no puede recibir una procedencia verificable, no debe convertirse en evidencia autorizada.
