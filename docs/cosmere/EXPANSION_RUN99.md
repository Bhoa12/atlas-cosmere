# Expansión Cosmere — Run 99

Esta iteración añade una capa reutilizable para representar **hojas de ruta de lectura explícitas** sin inferir estructura editorial.

## Modelo

Cada unidad contiene únicamente:

- identificador;
- obra a la que pertenece;
- posición explícita;
- identificador de fuente;
- indicador de accesibilidad.

La auditoría rechaza unidades con identificadores o posiciones duplicadas, obras distintas, fuentes vacías, posiciones inválidas o contenido no accesible.

## Progreso

El progreso se reconcilia exclusivamente dentro de la obra solicitada y devuelve unidades aceptadas en su orden explícito. Las referencias desconocidas o no accesibles no se convierten en progreso válido.

## Límite editorial

Esta capa **no crea capítulos, secciones, cronologías ni resúmenes**. El catálogo privado puede registrar fuentes y metadatos, pero una unidad solo entra en una hoja de ruta cuando ha sido declarada explícitamente y marcada como accesible.
