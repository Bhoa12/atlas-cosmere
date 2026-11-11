# Modelo de amenazas y matriz de garantías de Hoid IA

Este documento convierte la prevención de spoilers en invariantes comprobables. Complementa `PROGRESS_POLICY.md`, `PROVIDER_BOUNDARY.md` y `RESPONSE_POLICY.md`.

## Activos que deben protegerse

- El límite de lectura del usuario, por **obra y capítulo**.
- La procedencia de cada pieza de conocimiento.
- La separación entre metadatos bibliográficos y contenido narrativo.
- El texto privado protegido, que no debe exportarse ni reproducirse íntegramente.

## Fronteras de confianza

### Entrada de progreso

El progreso externo no es fiable hasta pasar la validación canónica. Datos duplicados, ambiguos, no finitos o desconocidos deben fallar de forma cerrada.

**Pruebas mínimas:** posición válida; capítulo inválido; duplicado de la misma obra; identificador desconocido; aislamiento entre obras.

### Recuperación

Solo pueden recuperarse entradas cuya procedencia y primera posición segura estén dentro del límite autorizado. La ausencia de una posición verificable no debe convertirse en una estimación.

**Pruebas mínimas:** entrada anterior permitida; entrada posterior bloqueada; posición desconocida no promocionada; dos obras con límites distintos.

### Proveedor

El proveedor es un componente de redacción, no de autorización. Debe recibir un snapshot editorial mínimo y no aliases internos ni estado mutable.

**Pruebas mínimas:** mutar el objeto original después de crear el snapshot; evidencia no autorizada; timeout; respuesta malformada.

### Salida

Toda salida, estructurada o libre, debe respetar el mismo límite narrativo. La repetición, el orden o el formato no pueden ampliar permisos.

**Pruebas mínimas:** claims duplicadas; evidencias repetidas; orden de evidencia distinto; presupuesto agregado; contenido posterior rechazado.

## Propiedades que deben mantenerse

1. **Fail-closed:** ante ambigüedad o error no se concede conocimiento adicional.
2. **No escalada entre obras:** progreso en una obra no desbloquea otra.
3. **No escalada entre capas:** recuperación, proveedor y salida no pueden ampliar autorización.
4. **Determinismo:** entradas equivalentes producen el mismo conjunto autorizado y una representación canónica de evidencia.
5. **Procedencia explícita:** los hechos narrativos deben poder vincularse a una fuente y posición verificables.
6. **Menor revelación:** la información autorizada solo se usa cuando es necesaria para la petición.

## Regresión obligatoria

Toda modificación de una frontera de autorización debe añadir o actualizar pruebas de regresión para el caso que motivó el cambio. Una prueba de integración no sustituye las pruebas unitarias de la frontera: el objetivo es detectar una regresión antes de que otra capa pueda ocultarla.

## Fuentes privadas

La bibliografía privada funciona como catálogo de procedencia y estructura de lectura. No autoriza copiar, subir o reconstruir texto protegido. Si un pasaje no está accesible, la arquitectura debe conservar la incertidumbre y no afirmar que fue consultado.
