# Política de recomendaciones seguras

Esta capa permite que Hoid IA recomiende una siguiente obra sin convertir la
recomendación en una fuente de spoilers.

## Entrada autorizada

Solo utiliza:

- progreso declarado explícitamente por el lector;
- identificadores y títulos del catálogo;
- tipo de obra y orden editorial configurado por la aplicación.

No recibe ni necesita texto de EPUB, pasajes, resúmenes de trama ni conocimiento
del proveedor de IA.

## Regla de seguridad

Una recomendación no puede revelar hechos narrativos para justificar por qué una
obra es recomendable. La justificación del contrato es deliberadamente
estructural: `catalog-order-and-declared-progress`.

Las obras ya presentes en el progreso declarado se excluyen. Si falta progreso,
es inválido o no existe una candidata segura, la capa devuelve una abstención.

## Integración

Esta política debe ejecutarse antes de cualquier proveedor. Un proveedor puede
redactar una explicación solo después de recibir una decisión autorizada y nunca
puede ampliar la lista con conocimiento narrativo no verificado.

El catálogo bibliográfico es una fuente de metadatos. La presencia de una obra
en el catálogo no afirma que su texto esté accesible ni autoriza a consultarlo.
