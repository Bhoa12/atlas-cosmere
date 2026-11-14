# Integridad atómica del borrador

La verificación de Hoid IA no debe funcionar como un filtro que elimina frases
peligrosas y conserva el resto. Una frase aparentemente segura puede haber sido
redactada usando conocimiento que no pertenece al progreso del lector.

`verifyDraftAtomically` aplica una frontera de fallo cerrado:

1. el proveedor recibe únicamente identificadores de evidencia ya autorizados;
2. cada afirmación debe contener texto y al menos una evidencia;
3. todas sus evidencias deben pertenecer al contexto autorizado;
4. si falla una sola afirmación, se rechaza el borrador completo.

Los motivos de rechazo son técnicos y no deben mostrarse al lector sin una capa
posterior de abstención neutral.

Este contrato no transporta texto de EPUB ni convierte el catálogo bibliográfico
en evidencia narrativa. Solo opera sobre la respuesta generada y referencias
previamente autorizadas por obra y progreso.
