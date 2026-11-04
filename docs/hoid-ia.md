# Hoid IA: arquitectura segura

Hoid IA está desacoplado de cualquier proveedor externo.

## Flujo

`UI -> HoidService -> guardQuestion -> HoidProvider (opcional) -> redactProviderAnswer -> UI`

- La UI entrega progreso real por libro y capítulo desde `CosmereContext`.
- Los spoiler gates requieren un libro y capítulo explícitos; no se desbloquean por la posición de un array.
- La pregunta se bloquea antes de invocar un proveedor.
- La respuesta del proveedor pasa por una segunda comprobación determinista antes de mostrarse.
- Si no hay proveedor o falla, el sistema responde de forma explícita y no inventa contenido.
- Ninguna clave de proveedor pertenece a un componente de React Native.

## Límites actuales

Los gates actuales son una base técnica, no un índice canónico completo. La siguiente fase debe construir un catálogo de entidades, eventos y conceptos con su primera aparición segura por libro/capítulo y utilizar recuperación de contexto autorizada. Hasta entonces, cualquier adaptador externo debe tratarse como experimental y mantener el principio de fallo seguro.

## Contrato de integración

Los proveedores futuros implementarán `HoidProvider`. La aplicación no debe depender de SDKs concretos ni exponer secretos de servidor en el cliente.

## Catálogo de continuidad

La base incluye ahora el contrato `src/data/hoidContinuityCatalog.ts` para registrar entidades sin copiar texto de las obras. Cada entrada define:

- identificador y alias;
- tipo de continuidad;
- primera posición segura por `bookId` y capítulo.

Las funciones del catálogo permiten comprobar si una entrada está desbloqueada y detectar coincidencias todavía bloqueadas. La comparación exige coincidencia del libro correcto: haber avanzado mucho en otra obra no desbloquea contenido futuro de un libro distinto.

El catálogo empieza deliberadamente vacío de afirmaciones editoriales. Debe poblarse a partir de fuentes verificadas y revisión humana, y las respuestas de proveedores externos siguen pasando por la guardia final.
