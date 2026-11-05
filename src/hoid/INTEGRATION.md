# Hoid IA — Integración segura

## Contrato de entrada

La UI debe convertir el progreso de Atlas a `AtlasReadingProgress` y usar `toHoidReadingPositions()`. El núcleo no debe recibir objetos de React, pantallas ni estado mutable de interfaz.

Un adaptador puede producir posiciones de libros desconocidos; antes de recuperar conocimiento o recomendar obras, esas posiciones deben contrastarse con el catálogo correspondiente.

## Política de incertidumbre

- capítulo inválido o ausente: no se interpreta como avance;
- identificador vacío: se descarta;
- progreso de una obra desconocida: no concede autorización;
- una respuesta sin proveedor: se comunica como indisponibilidad, nunca como contenido generado.

## Flujo de integración

1. Capturar el progreso actual.
2. Convertirlo a `ReadingPosition[]`.
3. Autorizar contexto por obra y capítulo.
4. Enviar al proveedor únicamente el contexto autorizado.
5. Filtrar la salida antes de mostrarla.
6. Si cualquier frontera no puede verificarse, devolver una respuesta segura.

## Privacidad y fuentes

Los EPUB privados no forman parte del bundle ni se envían automáticamente a proveedores. Las integraciones futuras deben usar únicamente conocimiento previamente autorizado y metadatos permitidos.
