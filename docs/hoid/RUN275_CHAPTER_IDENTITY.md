# Run 275 — identidad de capítulo ligada a edición

## Objetivo

Separar el número visible de capítulo de la identidad estable de la unidad de lectura. Un número de capítulo no es necesariamente único dentro de una edición: los TOC pueden repetirlo, incluir secciones con la misma numeración o agrupar varias unidades bajo una etiqueta igual.

## Contrato nuevo

`src/hoid/chapterIdentity.ts` añade:

- `HoidChapterIdentity`: identidad inmutable ligada a libro, manifiesto, edición, hash de navegación, unit ID, ordinal, número visible y locator exacto.
- `resolveHoidChapterIdentityInManifest()`: resuelve contra un manifiesto concreto.
- `resolveHoidChapterIdentity()`: resuelve contra el manifiesto actualmente registrado para una obra.
- `validateHoidChapterIdentityInManifest()` y `validateHoidChapterIdentity()`: revalidan la identidad frente al manifiesto exacto.

El número de capítulo es una etiqueta de presentación. Si hay varias unidades con ese número, o el manifiesto declara que el número es ambiguo aunque aún no enumere todos sus localizadores, el resolver devuelve `ambiguous`. La selección exacta exige `unitId` o `locatorId` de la edición. Si el manifiesto solo conserva un candidato de una etiqueta declarada ambigua, no se interpreta como unicidad; el recuento se expresa como desconocido. Nunca elige la primera coincidencia.

## Integración

- `canonicalEvidenceScope()` resuelve el capítulo de procedencia por locator exacto y exige que el umbral de desbloqueo identifique una única unidad.
- `validateHoidEditorialDraft()` valida `firstSafeAppearance` mediante el mismo resolver; una aparición en un número ambiguo no se acepta por orden de array.
- Las citas y los resúmenes siguen almacenando metadatos editoriales originales; no se introduce prosa EPUB.
- La creación del cursor numérico heredado también rechaza cualquier número declarado ambiguo, incluso si aún no tiene unidades enumeradas.
- No se modifica el esquema de cursor v1, el ledger, los manifiestos actuales ni los umbrales de desbloqueo.

## Política para Viento y verdad

La auditoría estructural de Run 274 detectó números repetidos 12 y 14. El manifiesto de producción sigue exponiendo únicamente el prefijo numérico 1–11. Este run añade el contrato para resolver unidades repetidas cuando exista una correspondencia exacta de unit ID/locator verificada, pero **no incorpora locators de los capítulos 12 o 14 ni amplía el progreso autorizado**. Los números 12 y 14 se reportan como ambiguos con cantidad de candidatos desconocida, no como capítulos inexistentes.

Las pruebas usan un manifiesto sintético con dos unidades numeradas como capítulo 12. Demuestran que la selección numérica sola se rechaza como ambigua y que una selección exacta puede resolverse sin elegir por posición.

## Límites de confianza

- La identidad de capítulo demuestra pertenencia a una unidad de un manifiesto; no demuestra que el contenido haya sido leído, resumido o aprobado.
- Un locator y un hash de navegación prueban estructura de edición, no hechos narrativos.
- La autorización sigue dependiendo de evidencias editoriales originales, revisión independiente, firma válida y progreso vivo.
- Un resumen en staging sigue sin ser conocimiento de producción.
- Los proveedores no reciben texto EPUB ni handles locales.

## Validación

El workflow dedicado ejecuta las pruebas de identidad, alcance de evidencias y drafts editoriales, además de TypeScript estricto en sus límites. La certificación solo se declarará después de que GitHub Actions termine sobre el HEAD final.
