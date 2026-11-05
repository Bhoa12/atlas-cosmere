# Consistencia de lectura en la expansión

Esta capa comprueba que las unidades de lectura y el progreso persistido estén
vinculados únicamente a IDs de obra declarados explícitamente.

## Principios

- Una unidad que referencia una obra desconocida se informa como problema.
- El progreso de una obra desconocida no desbloquea ni crea una obra.
- Un ID de unidad perteneciente a otra obra se informa como referencia ajena.
- El validador no deduce capítulos, orden editorial ni contenido narrativo.

La comprobación trabaja exclusivamente con metadatos técnicos y está diseñada
para reutilizarse en Scadrial, Sel, Nalthis, Taldain, Roshar y futuras
incorporaciones sin convertir datos incompletos en hechos editoriales.
