# Frontera de entrada de Hoid

Las preguntas del lector son datos no confiables hasta que superan la validación de entrada.

La normalización elimina controles de transporte y caracteres Unicode de formato invisibles, incluidos controles bidireccionales, antes de que la misma pregunta llegue al filtro anti-spoilers o a un proveedor. También aplica una normalización Unicode compatible y un límite de longitud.

Esta frontera no interpreta canon ni desbloquea conocimiento. Su función es garantizar que las capas posteriores evalúen una representación visible y consistente de la pregunta.

Una entrada vacía o inválida falla de forma cerrada con `input-invalid` y no se envía a ningún proveedor.
