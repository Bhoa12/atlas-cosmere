# Cobertura de obras declaradas

`resolveDeclaredWorkCoverage` compara una lista explícita de identificadores de obras del modelo de lectura con las vinculaciones explícitas `sourceId → workId`.

## Resultado

- **coveredWorkIds**: obras declaradas que tienen al menos una fuente catalogada vinculada explícitamente.
- **pendingWorkIds**: obras declaradas sin una vinculación explícita.
- **blocked**: catálogo, lista declarada o registro de vinculaciones inválido.

## Límites

Esta auditoría es estructural. No prueba que una fuente haya sido leída, que un pasaje esté disponible, ni autoriza por sí sola contenido narrativo. No utiliza títulos, nombres de mundos ni orden bibliográfico para inferir relaciones.

La capa está pensada para ampliar progresivamente mundos y obras sin convertir una bibliografía privada en contenido editorial verificado.
