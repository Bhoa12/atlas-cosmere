# Hoid IA — Run 363: preflight de paridad para promoción de afirmaciones

## Objetivo

Run 362 vinculó la clasificación epistemológica al hash de las afirmaciones exact-unit. Run 363 añade una comprobación obligatoria antes de entrar en la autoridad de promoción del host: la clasificación, el texto original y la procedencia deben coincidir entre el borrador atómico revisado y su contraparte exact-unit.

El adaptador de composición ejecuta el preflight antes de delegar en la autoridad de confianza existente. No crea una ruta de promoción paralela.

## Contratos

- El review kit debe superar validateHoidEditorialReviewKit() y conservar su manifiesto, paquetes, recibos, plan y contexto exactos.
- Debe existir exactamente una vinculación exact-unit por cada borrador atómico del kit; no se permiten vínculos ausentes, duplicados o inesperados.
- El paquete de revisión debe reconstruirse desde el borrador y su recibo debe ser estructuralmente aprobado.
- id, texto, intención y assertionKind deben coincidir exactamente entre borrador, paquete y claim exact-unit aprobado.
- Un claim exact-unit antiguo sin assertionKind se bloquea como no clasificado. No se infiere una categoría por su intención ni por su texto.
- El claim exact-unit debe superar su atestación de integridad y sus evidencias/políticas deben coincidir con el mapeo explícito de cada evidencia del borrador.
- El sujeto debe corresponder a una identidad de evidencia del mismo tipo editorial.
- Las referencias source, first-safe-appearance y unlock deben resolver a unidades exactas de sus manifiestos de edición.
- Cada fuente principal debe existir en la allowlist dispersa de documentos inspeccionados y su digest debe coincidir con la edición, navegación y documento del borrador.
- El host debe confirmar que el documento local está disponible y que sus bytes producen exactamente el digest esperado.

## Frontera de acceso a fuentes

HoidEditorialSourceDocumentAccessPort es un puerto local inyectado por el host. Recibe únicamente:

- ID de obra;
- edición y digest de navegación;
- número de capítulo;
- localizador relativo;
- digest esperado del documento.

Solo puede devolver available con un SHA-256, o unavailable. No puede devolver bytes EPUB, XHTML, texto extraído, títulos ni rutas privadas. El contrato tiene timeout y cancelación cooperativa.

Un digest coincidente demuestra disponibilidad e identidad del documento local; **no demuestra que un revisor haya leído el pasaje**. La revisión editorial firmada sigue siendo la prueba de revisión humana. Si el archivo no está montado, el adaptador bloquea la operación y no sustituye la fuente por inferencias.

## Integración con la autoridad protegida

createProductionHoidTrustedHostClaimPromotionAdapter() compone el preflight con authorizeHoidTrustedHostSignedEditorialBundlePromotion().

Solo después de superar el preflight se ejecuta la autoridad existente, que sigue siendo responsable de:

1. bootstrap de confianza fijado por el host y revisión mínima persistida;
2. quorum editorial firmado por revisores distintos;
3. firmas Ed25519 de todos los paquetes;
4. autorización de las claves para el repositorio;
5. aprobación protegida del PR y su HEAD exacto;
6. lectura fresca del progreso durable antes y después de la consulta de GitHub.

El kit y el plan entregados a esa autoridad deben ser exactamente los mismos que superaron el preflight. Se comparan plan, manifiestos, fuentes, recibos, PR, ramas y SHAs.

La salida satisfactoria sigue siendo únicamente ready-for-maintainer-commit. En todos los resultados:

- promotionAllowed = false
- productionWritePerformed = false

No se escribe el registro de conocimiento de producción, no se crea una activación y no se fusiona el PR.

## Pruebas

Las pruebas usan el inventario editorial existente y un puerto de acceso sintético que devuelve el digest esperado. Comprueban:

- paridad completa entre borrador, paquete y claim aprobado;
- discrepancia y ausencia de assertionKind;
- fuente no montada y digest incorrecto;
- mapeo de evidencias incompleto;
- identidad del sujeto incorrecta;
- desajuste del plan/contexto del PR;
- puerto con getter hostil;
- kit manipulado;
- delegación únicamente después del preflight;
- propagación de bloqueos del host;
- ausencia de texto y bytes en el contrato del puerto.

El puerto sintético no representa una inspección real de EPUB. Esta ejecución no añade nuevas inspecciones de capítulos ni nuevas afirmaciones narrativas.

## Privacidad y copyright

No se añaden EPUB, XHTML, pasajes, texto de capítulos ni rutas privadas. El adaptador solo maneja resúmenes originales ya presentes, metadatos de procedencia, IDs y fingerprints. El catálogo bibliográfico sigue siendo metadatos, no una prueba de disponibilidad física de todos los archivos.

## Limitación de despliegue

El repositorio aporta el contrato y la composición de producción, pero el host debe inyectar un adaptador local que abra los EPUB privados de forma segura y devuelva únicamente los digests. Si ese adaptador no está configurado o el archivo no está disponible, la promoción se bloquea. No se afirma que cosmere.epub ni todos los EPUB de Roshar estén montados en este entorno.


## Run 364 — regresiones de la frontera de acceso local

La frontera también rechaza respuestas del adaptador que añadan bytes EPUB,
texto extraído o rutas privadas: el objeto de salida admite únicamente
`status` y el digest documental. Una inspección que exceda el plazo aborta
la señal cooperativa y bloquea la delegación a la autoridad del host.

Estas pruebas son sintéticas y no inspeccionan archivos privados. La
implementación concreta del lector local sigue siendo responsabilidad del
host de despliegue; no se declara disponible ningún EPUB por el mero hecho
de que exista una entrada bibliográfica o un digest registrado.
