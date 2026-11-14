# Atlas del Cosmere

## Hoid IA: arquitectura segura y desacoplada

Hoid IA está diseñada como una capa de asistencia adaptada al progreso de lectura. La seguridad contra spoilers no depende del modelo o proveedor concreto: la aplicación construye una frontera de conocimiento antes de solicitar una respuesta y valida la salida antes de mostrarla.

### Flujo de seguridad

1. **Catálogo bibliográfico**: registra únicamente metadatos de las fuentes privadas.
2. **Progreso del lector**: identifica la obra y el capítulo alcanzado.
3. **Procedencia**: solo se aceptan resúmenes originales respaldados por una fuente realmente accesible.
4. **Admisión de contexto**: una pieza narrativa debe pertenecer a la misma obra y no superar el capítulo autorizado.
5. **Frontera de conocimiento**: se entrega al proveedor una instantánea inmutable de la evidencia permitida.
6. **Proveedor desacoplado**: el proveedor recibe una solicitud normalizada, nunca acceso directo al EPUB ni autoridad global sobre el Cosmere.
7. **Verificación atómica**: toda afirmación narrativa debe estar respaldada por evidencia autorizada; si una falla, se rechaza el borrador completo.
8. **Integridad de salida**: el texto visible no puede contener prosa narrativa adicional fuera de las afirmaciones verificadas.
9. **Recomendaciones**: las recomendaciones estructurales no inventan hechos; las narrativas requieren el mismo respaldo que una respuesta.
10. **Auditoría segura**: registra decisiones y códigos técnicos, no extractos ni texto protegido.

### Política de fallo cerrado

Cuando falta evidencia accesible o una afirmación no puede vincularse a la frontera de conocimiento de la solicitud, Hoid IA debe limitar la respuesta o abstenerse de forma neutral. El catálogo no se considera evidencia narrativa.

### Catálogo de fuentes privadas

La bibliografía se utiliza como catálogo de metadatos y estructura de lectura, sin copiar ni subir texto íntegro protegido.

**cosmere.epub (índice verificado):**
- El Imperio Final
- El Pozo de la Ascensión
- El Héroe de las Eras
- Aleación de ley
- Sombras de identidad
- Brazales de Duelo
- El metal perdido
- El aliento de los dioses
- Elantris
- Arena blanca, volúmenes 1 a 3
- Trenza del mar Esmeralda
- Yumi y el pintor de pesadillas
- El Hombre Iluminado
- Islas de la ascuaoscura
- Arcanum ilimitado

**Roshar (EPUBs privados):**
- Las cinco novelas principales de El Archivo de las Tormentas
- Danzante del Filo
- Esquirla del amanecer

La presencia de una obra en este catálogo no implica que un pasaje concreto haya sido consultado. Si un contenido no está accesible en el entorno de recuperación, la arquitectura no inventa hechos ni afirma haberlo leído.

### Contratos previstos

La implementación de Hoid IA debe mantener contratos separados para:

- progreso de lectura;
- catálogo de fuentes;
- procedencia de evidencia;
- selección y admisión de contexto;
- frontera de conocimiento;
- proveedor de IA;
- afirmaciones verificables y borradores;
- integridad y decisión de respuesta;
- recomendaciones;
- auditoría.

Cada contrato debe poder probarse de forma aislada y no debe depender de un proveedor específico.

### Criterio de implementación

Las respuestas, explicaciones y recomendaciones se generan a partir de resúmenes originales y metadatos autorizados. No se incorporan extractos extensos ni copias del contenido protegido de los EPUBs al repositorio.
