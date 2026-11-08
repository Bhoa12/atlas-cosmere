# Hoid IA: matriz de fronteras de confianza

## Principio central

Hoid debe fallar de forma conservadora: ningún dato no confiable puede aumentar el conocimiento narrativo enviado a un proveedor ni ampliar el progreso efectivo del lector.

## Fronteras

| Origen | Tratamiento obligatorio | Puede llegar al proveedor |
| --- | --- | --- |
| Pregunta del lector | Normalización Unicode y validación | Sí, solo en forma canónica |
| Progreso del lector | Validación en tiempo de ejecución y autorización contra el catálogo | Sí, solo como snapshot canónico |
| Conocimiento aportado por el llamador | No se confía en él | No |
| Catálogo editorial | Validación de estructura y procedencia | Solo si está `verified` y desbloqueado |
| Salida del proveedor | Normalización, validación y comprobación anti-spoilers | Solo después puede mostrarse |

## Invariantes

1. El proveedor no decide qué contenido está desbloqueado.
2. Una posición de lectura inválida o ambigua no puede desbloquear contenido; tanto el progreso del lector como los capítulos de desbloqueo del catálogo solo aceptan enteros finitos no negativos.
3. Completar una obra no desbloquea automáticamente otra.
4. Una entrada editorial sin procedencia `verified` no entra en la recuperación.
5. Los snapshots enviados al proveedor no reutilizan objetos mutables de la petición.
6. La salida externa se considera no confiable hasta superar las comprobaciones de seguridad.
7. La ausencia de contexto verificado nunca autoriza a inventar hechos.
8. El conocimiento narrativo aportado por el llamador, aunque tenga una estructura válida, nunca cruza la frontera del proveedor.\n9. Las capas de bajo nivel que reciben progreso directamente vuelven a canonicalizarlo; un valor no entero, negativo o no finito se omite y nunca incrementa una autorización.

## Bibliografía

La bibliografía privada aportada por el usuario funciona como catálogo de fuentes y estructura de lectura. Los EPUB no se incorporan al repositorio como corpus ni se copian de forma íntegra. Los hechos editoriales solo deben incorporarse mediante metadatos y resúmenes originales respaldados por una fuente accesible.
