# Expansión Cosmere: Run 67

Esta iteración añade una capa de **reconciliación de progreso** para que Atlas del Cosmere pueda combinar estados de lectura procedentes de distintas superficies o sesiones sin convertir datos no válidos en desbloqueos.

## Arquitectura

La capa mantiene separados:

**mundos → obras → unidades de lectura → snapshots de progreso → estado reconciliado → puertas anti-spoilers**

### Reconciliación conservadora

`reconcileProgress`:

- acepta varios snapshots de una misma obra;
- ignora snapshots de otras obras;
- descarta IDs de unidades desconocidas;
- elimina duplicados;
- devuelve las unidades completadas en el orden explícito de lectura.

No presupone capítulos, escenas ni estructura editorial: solo opera sobre unidades que ya existan como metadatos válidos.

### Anti-spoilers

`evaluateSpoilerGate` evalúa siempre el progreso reconciliado. La política sigue siendo **fail-closed**:

- requisitos vacíos o duplicados bloquean;
- requisitos desconocidos bloquean;
- si no existe ningún snapshot para la obra correcta, el contenido bloquea;
- solo todas las unidades requeridas y válidas desbloquean.

## Catálogo y procedencia

Se conservan como mundos prioritarios Scadrial, Sel, Nalthis, Taldain y Roshar. Los títulos del índice verificado aportado por el usuario se mantienen como metadatos bibliográficos.

No se infiere pertenencia de una obra a un mundo a partir del título, ni se crean capítulos o hechos narrativos a partir de fuentes privadas no inspeccionadas. No se copia ni almacena texto protegido de los EPUB.

Las pruebas usan exclusivamente datos sintéticos.
