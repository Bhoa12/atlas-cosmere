# Run 375 — gate de promoción de afirmaciones atómicas vinculado a fuentes

## Objetivo

Extender a las afirmaciones narrativas atómicas la misma garantía de doble inspección local que Run 374 añadió a los resúmenes.

El nuevo gate no sustituye la revisión de afirmaciones existente. Compone:

- el paquete editorial validado;
- el preflight de paridad entre borrador, paquete, recibo, afirmación aprobada, evidencia y política;
- el adaptador de host confiable existente;
- una segunda auditoría documental después de la autorización.

## Secuencia

`createHoidSourceBoundAtomicClaimPromotionGatePort` recibe un puerto local de acceso documental y la autoridad de host confiable:

1. Valida la forma exacta del input y reconstruye el review kit.
2. Captura fingerprints del review kit, plan, claim bindings y datos JSON del input de host. Conserva además la identidad de los puertos de confianza.
3. Delega en `createHoidTrustedHostClaimPromotionAdapter`. Este ejecuta la primera auditoría de todas las afirmaciones atómicas y sus fuentes antes de llamar a la autoridad de host.
4. La autoridad existente verifica el bootstrap fijado, el registro Ed25519, las firmas, el quórum independiente, el estado protegido del Pull Request y el progreso autoritativo.
5. Si la autoridad está lista para revisión de commit, el gate vuelve a validar el review kit, fingerprints, bindings y referencias de los puertos.
6. Ejecuta una segunda auditoría completa de todas las fuentes.
7. Exige igualdad exacta entre la auditoría previa y la posterior. Un digest distinto, una fuente no montada, un cambio de bindings o una modificación concurrente bloquean el resultado.

## Frontera de fuente

Cada evidencia debe conservar su vínculo exacto con:

- obra y edición;
- navegación verificada;
- capítulo y locator;
- digest XHTML registrado;
- unidad de lectura;
- primera aparición segura;
- umbral de desbloqueo.

El adaptador de fuente solo puede devolver estado y digest. La auditoría rechaza respuestas que incluyan texto, bytes, rutas o propiedades adicionales.

La doble inspección demuestra disponibilidad e identidad de bytes en dos momentos. No demuestra por sí sola que un revisor haya leído el pasaje ni que la interpretación sea correcta; eso sigue siendo responsabilidad de la revisión editorial independiente autenticada.

## Minimización de datos

El resultado exitoso devuelve únicamente:

- fingerprint del review kit y del plan;
- fingerprint del preflight;
- número de afirmaciones y documentos verificados;
- recuento por clase epistemológica;
- número de pasadas de inspección.

No devuelve prosa de afirmaciones, IDs de evidencia, locators, digests documentales, rutas ni texto fuente.

## Límites de autoridad

El estado `ready-for-maintainer-commit` solo indica que el expediente pasó ambas auditorías y la autoridad de host confiable.

Siempre permanecen:

- `promotionAllowed: false`
- `productionWritePerformed: false`
- `answerAuthorizationEffect: none`
- `spoilerUnlockEffect: none`
- `providerEgress: none`

No se escribe el registro de conocimiento de producción, no se fusiona el Pull Request, no se modifica el progreso y no se autoriza ninguna respuesta narrativa.

## Composición

- Producción: `createProductionHoidSourceBoundAtomicClaimPromotionGatePort`, que delega en la autoridad Ed25519 fijada del host.
- Pruebas: `createHoidSourceBoundAtomicClaimPromotionGatePort`, que permite inyectar una autoridad sintética para probar carreras, bloqueos y fallos.

La autoridad inyectada es un seam de composición para tests; la aplicación debe usar la fábrica de producción o una autoridad equivalente cuya identidad y bootstrap estén fijados por el host.

## Validación

El workflow Run 375 ejecuta:

- doble inspección de afirmaciones;
- preflight de paridad de claims;
- gate de promoción de resúmenes;
- autoridad de host confiable y quórum;
- integridad exacta de claims;
- TypeScript estricto.

Las pruebas usan paquetes y adaptadores sintéticos. No requieren ni afirman que los EPUB privados estén montados en GitHub Actions.
