# Hoid IA: frontera de progreso

El catálogo bibliográfico solo describe qué obras existen en la colección. No concede acceso narrativo.

## Contrato

`buildProgressIndex` valida el progreso declarado por el lector y conserva el capítulo más alto para cada obra. `authorizeScope` decide si un elemento narrativo puede entrar en el contexto de una petición.

La política es de **fallo cerrado**:

- sin progreso explícito para una obra, no hay contexto narrativo;
- un capítulo posterior al alcanzado se rechaza;
- identificadores vacíos o capítulos inválidos se rechazan;
- el contrato no interpreta ni recupera texto de EPUB.

Este contrato debe ejecutarse antes de entregar cualquier resumen narrativo a un proveedor. El proveedor recibe únicamente contenido que ya haya superado esta frontera y nunca los EPUB privados completos.
