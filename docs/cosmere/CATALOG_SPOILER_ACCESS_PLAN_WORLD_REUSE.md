# Reutilización del plan de acceso por mundo

`resolveCatalogSpoilerAccessPlan` aplica el mismo contrato técnico a cualquier mundo que tenga obras declaradas en el catálogo verificado.

## Contrato

La composición solo usa:

- identificadores canónicos de mundo;
- identificadores de obras presentes en el catálogo;
- una cardinalidad explícita de posiciones;
- coordenadas técnicas de progreso;
- identificadores técnicos de contenido.

La pertenencia al mundo se valida antes de evaluar la frontera anti-spoilers. Una solicitud de contenido con un `contentWorldId` distinto queda bloqueada aunque la obra y el progreso sean válidos por separado.

## Cobertura reutilizable

Las pruebas de reutilización ejercitan el mismo flujo para Scadrial, Sel, Nalthis y Taldain. No codifican una estructura narrativa específica para esos mundos: los nombres solo verifican que el contrato funciona con asignaciones ya declaradas en el catálogo.

El módulo no define orden editorial, capítulos ni hechos del canon, y no inspecciona ni reproduce texto de EPUB.
