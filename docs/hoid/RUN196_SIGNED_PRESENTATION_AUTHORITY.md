# Run 196 — autenticidad criptográfica en la presentación final

## Hallazgo

Run 195 añadió una frontera que reconstruye el texto desde afirmaciones locales y valida sus fingerprints SHA-256. Sin embargo, la atestación SHA-256 de approvedClaimIntegrity no autentica al revisor: su función de creación puede producir hashes deterministas a partir de un reviewerId declarativo. El propio contrato ya advertía que no son firmas digitales.

Por tanto, esa fábrica no debe ser la única autoridad de producción.

## Implementación

Se añade createHoidTrustedVerifiedAnswerPresenter:

- exige una envoltura firmada Ed25519 para cada afirmación;
- carga la raíz exclusivamente desde el bootstrap fijado por el host;
- valida el repositorio permitido y la vigencia del bootstrap;
- comprueba la revisión durable antes de usar el registro;
- autentica la firma raíz del trust registry y persiste su revisión monotónica;
- verifica todas las firmas de afirmaciones contra claves de revisores activas y autorizadas;
- liga cada firma al contexto exacto del PR, refs, SHAs, manifiesto, plan, bundle y fingerprints;
- reconstruye la respuesta con createHoidVerifiedAnswerPresenter solo después de verificar las firmas;
- vuelve a comprobar en cada presentación la vigencia del bootstrap, su fingerprint y la igualdad exacta de la revisión persistida.

El presentador se invalida si cambia la revisión de confianza, caduca el registro o rota el bootstrap.

## Pruebas

Once pruebas cubren construcción válida, firma de revisor alterada, replay contra otro HEAD, firma raíz manipulada, revisión no inicializada o retrocedida, repositorio incorrecto, invalidación por nueva revisión, expiración, bloqueo N+1, getters y conjunto vacío.

Las pruebas usan un verificador determinista falso; el adaptador Ed25519 real y su vector RFC 8032 continúan cubiertos por la suite editorialReviewSignatures.

## Límites

- No se añaden afirmaciones aprobadas ni conocimiento de producción.
- No se conecta una clave privada ni se firma desde la aplicación.
- La promoción del paquete editorial sigue siendo un gate separado y conserva sus requisitos de múltiples revisores y revisión de GitHub.
- El host debe mantener un bootstrap real, una raíz fijada fuera de banda, un trust registry actual y un almacén durable anti-rollback.
- No se inspeccionan nuevos EPUBs ni se incorporan pasajes.

## Validación

El workflow específico ejecuta las once pruebas nuevas junto con las suites existentes de presentación, firmas, bootstrap y revisión monotónica, y realiza TypeScript estricto.

El PR permanece en borrador hasta que todas las comprobaciones terminen sobre el HEAD final.
