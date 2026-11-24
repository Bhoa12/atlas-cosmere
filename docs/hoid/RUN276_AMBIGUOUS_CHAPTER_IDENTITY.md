# Run 276 — identidades exactas para capítulos con numeración duplicada

## Objetivo

Resolver las etiquetas de capítulo repetidas de una edición concreta sin convertir esa resolución en permiso de progreso. La auditoría se limita a metadatos de navegación del EPUB privado de Roshar.

## Inspección de fuente

Se inspeccionó únicamente el documento de navegación `OEBPS/Text/nav.xhtml`, los metadatos OPF necesarios para comprobar la pertenencia de los hrefs al manifiesto y las referencias correspondientes del spine. No se abrió ningún cuerpo XHTML de capítulo.

- Edición: `roshar-omnibus-v1`.
- SHA-256 de navegación: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`.
- Entradas de capítulos numerados: 149.
- Números distintos: 147.
- Etiquetas duplicadas: 12 y 14.
- Los cuatro hrefs exactos están en el manifiesto OPF y en el spine.

| Número visible | Ordinal de unidad | Locator relativo |
|---:|---:|---|
| 12 | 12 | `L5-023.xhtml` |
| 12 | 14 | `L5-028.xhtml` |
| 14 | 15 | `L5-030.xhtml` |
| 14 | 35 | `L5-055.xhtml` |

Los ordinales se cuentan entre las entradas de capítulos numerados del TOC; no son números de capítulo alternativos ni títulos narrativos.

## Cambios

- `verifiedChapterLocators.ts` incorpora cuatro locators de unidades ambiguas, ligados a la misma edición y al hash de navegación.
- `getVerifiedAmbiguousChapterLocatorEntries()` solo devuelve identidades para la edición y el digest exactos.
- `readingManifest.ts` añade esas cuatro unidades al manifiesto parcial, con IDs y ordinales estables.
- `chapterIdentity.ts` puede resolver cada unidad por su locator exacto y sigue devolviendo `ambiguous` si solo se proporciona el número visible.
- Las proyecciones de respuestas y recomendaciones vuelven a resolver las citas contra la identidad de edición y conservan únicamente `chapterOrdinal` junto al número visible. No conservan el locator.
- Los resúmenes transversales que solo contienen números visibles se rechazan si alguno corresponde a una etiqueta ambigua.
- HoidScreen distingue visualmente las citas con ordinal distinto y no conserva contexto conversacional heredado cuando ese contexto solo puede representar el número ambiguo.

## Garantías que no cambian

- El cursor numérico v1 sigue bloqueado en el prefijo seguro 1–11 de Viento y verdad.
- Las etiquetas 12 y 14 no se convierten en progreso.
- Las unidades intermedias no incorporadas al manifiesto no se inventan.
- La identidad exacta no autentica hechos narrativos, no acredita lectura y no aprueba resúmenes.
- `canonicalEvidenceScope()` sigue exigiendo un umbral de desbloqueo único; una identidad de origen exacta no puede desbloquear por sí sola una afirmación.
- No se modifica SQLite, el ledger, los umbrales editoriales ni la firma de revisión.
- No se incorpora texto EPUB, XHTML, títulos de capítulos ni prosa protegida.

## Limitación de contexto conversacional

El binding conversacional existente conserva capítulos como números, no como identidades de unidad. Para evitar que una cita desambiguada se convierta en un contexto ambiguo, HoidScreen rechaza la respuesta en la ruta conversacional cuando `chapterOrdinal !== chapter`. La proyección de presentación puede representar la cita exacta, pero la continuidad conversacional sobre esa unidad requiere un contrato de binding versionado en una iteración posterior.

## Fuentes no revalidadas

No se encontró `cosmere.epub` entre los EPUB accesibles en esta ejecución. Por tanto, no se añaden locators exactos para las etiquetas duplicadas de Elantris (48, 51 y 57). Su manifiesto continúa limitado al prefijo verificado.

## Validación

El workflow dedicado ejecuta Vitest sobre manifiestos, identidades, alcance de evidencias y proyecciones de presentación, además de TypeScript estricto sobre los módulos y HoidScreen. La certificación se declarará solo cuando GitHub Actions termine sobre el HEAD final.
