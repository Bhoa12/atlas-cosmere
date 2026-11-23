# Run 253 — Frontera de entrada para explicaciones de recomendaciones

## Objetivo

Endurecer `explainEditionBoundRecommendationResult()`, una función exportada que transforma recomendaciones edition-bound en texto visible. La forma TypeScript de entrada no es una garantía de procedencia: JavaScript, datos persistidos o integraciones futuras pueden pasar objetos manipulados.

La función ahora recibe `unknown`, canonicaliza registros y arrays sin ejecutar getters, y vuelve a derivar la identidad bibliográfica, el capítulo, el cursor, la edición y el localizador a partir del catálogo y de los manifiestos incluidos en el repositorio.

## Invariantes

- Solo se aceptan identidades y títulos exactos de `HOID_SOURCE_BIBLIOGRAPHY`.
- La revisión debe ser un entero seguro no negativo.
- Los arrays deben ser densos, tener el prototipo esperado y no contener propiedades adicionales.
- Los registros deben ser objetos de datos planos, sin getters, setters ni claves inesperadas.
- Cada capítulo recomendado debe existir en el manifiesto exacto de la obra.
- El watermark completado debe corresponder a la unidad inmediatamente anterior del manifiesto; para el capítulo 1 debe ser `null`.
- El cursor, el ID de manifiesto, la edición, la huella de navegación y el localizador deben coincidir exactamente con los valores reconstruidos.
- Una recomendación de catálogo solo puede usar el estado `catalog-only` que corresponda realmente a la disponibilidad del manifiesto.
- Solo puede aparecer una recomendación de reanudación y debe ir antes de los descubrimientos.
- Los descubrimientos deben seguir estrictamente el orden del catálogo y no pueden duplicarse.
- Las opciones de selección explícita deben ser únicas, verificables y estar en orden bibliográfico canónico.
- Cualquier discrepancia devuelve `unavailable / invalid-recommendation`; no se intenta reparar ni ordenar silenciosamente la entrada.

## Separación de responsabilidades

Esta frontera valida la coherencia estructural de la explicación. No autentica por sí sola el ledger ni demuestra que el lector haya avanzado: el adaptador de presentación sigue validando el snapshot v2, y HoidScreen debe comparar la revisión y la huella del progreso antes de mostrar o utilizar el resultado.

La navegación sigue siendo una operación separada. Antes de abrir un capítulo, el host debe llamar a `prepareHoidRecommendationNavigationHandoff()` con el progreso vivo y la identidad de la presentación.

Las explicaciones describen únicamente metadatos observables: obra iniciada, capítulo abierto, watermark completado, disponibilidad del manifiesto y estado del localizador. No generan razones argumentales, cronologías, dependencias entre novelas ni afirmaciones narrativas.

## Pruebas

Se incorporan regresiones para:

- IDs y títulos manipulados.
- Watermarks incompatibles con el manifiesto.
- Sustitución de localizadores.
- Múltiples reanudaciones o descubrimientos fuera de orden.
- Opciones de selección duplicadas o reordenadas.
- Getters que no deben ejecutarse.
- Trampas de Proxy que lanzan excepciones.
- Arrays dispersos, propiedades adicionales y revisiones inválidas.

El workflow de recomendaciones ejecuta tanto las pruebas de explicaciones como las del adaptador de presentación y aplica TypeScript estricto a ambos módulos.

## Privacidad y spoilers

Solo se usan fixtures sintéticos, IDs bibliográficos y manifiestos de navegación ya incluidos. No se leen ni incorporan bytes EPUB, XHTML, pasajes, localizadores privados nuevos, resúmenes narrativos ni afirmaciones editoriales. La validación no modifica el progreso ni amplía permisos de capítulo.

## Límite de confianza

La comprobación evita que una estructura de recomendación forjada produzca texto explicativo engañoso. No sustituye la autoridad editorial firmada, la validación del snapshot, la comprobación de frescura ni la revalidación de navegación. Una obra presente en el catálogo no se considera por ello narrativamente inspeccionada.
