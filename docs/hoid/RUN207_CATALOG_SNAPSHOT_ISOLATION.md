# Run 207 — Aislamiento e integridad del catálogo de conocimiento

## Hallazgo

HoidKnowledgeCatalog hacía una copia superficial de los metadatos recibidos en su constructor. Las listas y los objetos anidados quedaban separados del importador, pero los métodos findMatches() y entriesForContext() devolvían referencias a los mismos objetos internos.

Esto permitía que un consumidor modificase, después de construir el catálogo, campos relevantes para la autorización:

- aliases utilizados para detectar menciones;
- primera aparición segura;
- fuente y watermark de desbloqueo;
- resumen editorial.

Además, isEntityMentionUnlocked(entry, reading) confiaba en el firstSafeAppearance del objeto recibido, sin demostrar que ese objeto fuese la entrada canónica retenida por el catálogo. Un objeto con el mismo identificador y un watermark anterior podía obtener una decisión positiva.

## Corrección

- El constructor toma un snapshot estructuralmente validado y limitado a 512 entradas.
- Se aceptan únicamente objetos planos con propiedades de datos propias; getters, símbolos, propiedades desconocidas y arrays dispersos se rechazan sin ejecutar accesores.
- Cada entrada debe tener ID no vacío, tipo de conocimiento canónico, aliases únicos tras normalización Unicode y primera aparición en un capítulo existente del manifiesto verificado.
- Las identidades duplicadas tras NFKC y minúsculas se rechazan como grupo.
- Las tuplas opcionales de evidencia solo se conservan cuando libro, capítulo y locatorId coinciden con el manifiesto exacto. Una tupla inválida se omite; por ello no puede autorizar un resumen.
- evidenceUnlock solo se conserva si pertenece a la misma obra, existe en el manifiesto y no precede al capítulo de evidencia.
- El estado interno usa un campo privado ECMAScript y snapshots profundamente congelados.
- findMatches() y entriesForContext() devuelven copias desacopladas; mutarlas no cambia futuras decisiones del catálogo.
- isEntityMentionUnlocked() canonicaliza el objeto recibido y exige igualdad con la entrada retenida para ese ID. El watermark de un objeto externo nunca se convierte en autoridad.
- Las consultas de texto superiores a 20.000 caracteres se rechazan sin recorrer el catálogo.
- La normalización de alias conserva la eliminación de caracteres invisibles y marcas combinantes; los límites Unicode de palabra se construyen con propiedades Unicode reales.

## Contratos preservados

- La autorización de mención sigue separada del desbloqueo del resumen completo.
- entriesForContext() continúa exigiendo provenance = verified, resumen original, fuente ligada a una edición, watermark explícito y progreso suficiente.
- El progreso sigue validándose mediante buildReadingContext() y los manifiestos existentes.
- El catálogo sigue siendo metadata + resúmenes editoriales originales; no contiene pasajes de los EPUBs.
- No se añaden proveedores, SDK, claves ni dependencias.

## Pruebas añadidas

src/hoid/catalogTrustBoundary.test.ts cubre:

1. mutación de los objetos anidados originales después de construir el catálogo;
2. mutación de copias devueltas por findMatches();
3. mutación de copias devueltas por entriesForContext();
4. objeto forjado con el mismo ID y una primera aparición anterior;
5. getter hostil sin ejecución;
6. obra desconocida, capítulo cero y capítulo fuera del manifiesto;
7. IDs duplicados tras normalización;
8. aliases duplicados tras normalización Unicode;
9. localizador de evidencia que no coincide con el manifiesto;
10. arrays dispersos y catálogos por encima del límite.

El workflow hoid-catalog-evidence-unlock.yml ejecuta esta suite junto a las pruebas de contexto, evidencia y HoidService, y aplica TypeScript estricto a las fronteras afectadas.

## Privacidad y alcance

- Solo se usan fixtures sintéticos y localizadores del manifiesto ya verificado.
- No se inspeccionan ni copian cuerpos XHTML, pasajes, imágenes ni texto protegido.
- No se modifica el progreso de lectura, el registro editorial de producción ni los recibos de activación.
- No se aprueba ningún resumen ni afirmación narrativa.
- La bibliografía privada sigue siendo un catálogo de metadatos.

## Validación

La validación de GitHub Actions del HEAD final debe determinar el estado de CI. No se declara una suite satisfactoria antes de que GitHub publique su conclusión.

## Aislamiento

- Base: feat/hoid-ia-core-run206
- Base SHA: 7fe4bbdcb2bf56e50d26e4f08198482fc47566e1
- Rama: feat/hoid-ia-core-run207
- Sin cambios en main, PR #99 ni ramas anteriores.
- PR de esta iteración se mantiene en Draft; no hay merge automático.
