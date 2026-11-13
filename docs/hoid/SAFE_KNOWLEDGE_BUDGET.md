# Hoid IA: contrato de presupuesto y degradación segura

## Objetivo

Cada solicitud se ejecuta contra un presupuesto de conocimiento inmutable. Ninguna etapa posterior puede ampliarlo.

## Entrada

La frontera recibe únicamente:

- una instantánea validada del progreso, por obra y capítulo;
- identificadores canónicos del catálogo;
- registros editoriales con procedencia verificable;
- preferencias explícitas del lector, separadas del conocimiento narrativo.

Los EPUB privados no se copian a esta frontera ni se transmiten a proveedores. Los pasajes no accesibles se representan como indisponibles.

## Algoritmo normativo

1. Normalizar obra y capítulo.
2. Congelar la instantánea de progreso.
3. Rechazar registros sin procedencia verificable.
4. Conservar solo registros cuya posición sea menor o igual al progreso de esa obra.
5. Derivar un conjunto de identificadores de evidencia.
6. Construir contexto mínimo desde esos registros.
7. Enviar la propuesta al proveedor mediante un contrato neutral.
8. Exigir que cada afirmación cite evidencia del conjunto derivado.
9. Eliminar afirmaciones sin respaldo.
10. Aplicar un filtro final de spoilers y presentar el resultado.

Un reintento reutiliza exactamente el mismo presupuesto. Un fallo de recuperación, proveedor o validación termina en `failed_safe`, `limited` o `abstain`; nunca desbloquea contexto adicional.

## Separación de recomendaciones

Las recomendaciones no deben inferir acontecimientos futuros. Pueden usar progreso validado, metadatos y preferencias explícitas. Si una recomendación necesita conocimiento narrativo no autorizado, debe limitarse a metadatos o abstenerse.

## Invariantes comprobables

- Cambiar el objeto de progreso original después de crear la instantánea no altera la solicitud.
- Una evidencia de otra obra no queda autorizada por coincidencia de número de capítulo.
- La existencia global de un registro editorial no implica autorización.
- Un proveedor no puede convertir `unknown` o `unavailable` en `verified`.
- La trazabilidad almacena decisiones e identificadores, no contenido narrativo.
- Las transformaciones posteriores solo pueden reducir el presupuesto.

## Casos de prueba mínimos

1. Progreso posterior añadido durante una generación: la respuesta sigue usando la instantánea inicial.
2. Respuesta mixta: sobreviven solo las afirmaciones respaldadas.
3. Evidencia de capítulo futuro: se elimina aunque el registro exista.
4. Fuente no accesible: no se inventan hechos ni se afirma haberla consultado.
5. Recomendación: no revela acontecimientos posteriores al progreso.
