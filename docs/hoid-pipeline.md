# Flujo integral y frontera de conocimiento de Hoid IA

La ruta de una consulta debe mantenerse explícita:

1. **Guardia de entrada:** se bloquean referencias conocidas que todavía no estén desbloqueadas.
2. **Recuperación autorizada:** cada elemento se evalúa contra el progreso del mismo `bookId` y capítulo.
3. **Proveedor:** solo un proveedor que implemente `ContextualHoidProvider` recibe el contexto autorizado. Un proveedor básico conserva el contrato anterior y no recibe el catálogo.
4. **Guardia de salida:** la respuesta pasa por una segunda comprobación antes de llegar a la interfaz.

## Principio de fallo seguro

- Sin proveedor configurado, no se realiza ninguna llamada externa.
- Si el proveedor falla, Hoid no inventa una respuesta ni cambia silenciosamente a otro servicio.
- El progreso en una obra no desbloquea información de otra.
- El catálogo contiene metadatos y resúmenes originales verificados; no debe contener pasajes íntegros de las fuentes privadas.

## Integración futura

Un adaptador de proveedor debe vivir fuera de la interfaz y traducir únicamente el contrato neutral de Hoid a su SDK. Las credenciales no deben almacenarse en componentes de React Native ni en el repositorio.
