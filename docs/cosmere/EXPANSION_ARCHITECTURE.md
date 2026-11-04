# Expansión del Cosmere: arquitectura base

## Objetivo

Separar el sistema reutilizable de catálogo y progreso del contenido editorial.
Roshar puede seguir evolucionando sin que los demás mundos tengan que copiar sus
modelos específicos.

## Capas

1. **World catalog**: identifica mundos y obras.
2. **Reading units**: representa prólogos, capítulos, interludios y otras
   unidades ordenadas.
3. **Reader progress**: guarda el último orden completado por obra.
4. **Spoiler gates**: cada pieza editorial exige una coordenada mínima
   `workId + minimumUnitOrder`.
5. **Content source**: todo contenido publicado debe conservar un localizador de
   fuente. La capa estructural no inventa sinopsis ni hechos.

## Integración propuesta

- Mantener los datos actuales de Roshar como implementación existente.
- Adaptar gradualmente los consumidores para aceptar `WorldCatalogEntry`.
- Añadir obras y unidades de Scadrial, Sel, Nalthis y Taldain únicamente tras
  validar sus fuentes.
- Migrar el contenido editorial a `CatalogContent<T>` para que el mismo filtro
  anti-spoilers funcione en todos los mundos.

## Criterio de seguridad

Un elemento no es visible hasta que `hasReachedGate` confirma que el progreso
del lector alcanza su unidad exacta. Esto evita depender de un orden global de
libros y permite novelas cortas, historias paralelas y futuras obras.

## Validación

`validateCatalog` detecta identificadores duplicados, obras asignadas al mundo
equivocado y unidades de lectura mal ordenadas. Antes de publicar catálogos
editoriales completos se debe añadir una suite de pruebas al proyecto.
