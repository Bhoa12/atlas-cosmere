# Cobertura de vinculaciones fuente → obra

`resolveSourceBindingCoverage` audita la cobertura entre un catálogo bibliográfico
declarado y un registro explícito de vinculaciones fuente → obra.

## Reglas

- una fuente solo cuenta como cubierta cuando existe una vinculación explícita;
- no se infieren relaciones a partir de títulos, orden o colecciones;
- una vinculación que apunta a una fuente inexistente bloquea el resultado;
- un catálogo o registro malformado bloquea el resultado;
- una fuente sin vinculación permanece explícitamente como pendiente.

La utilidad no lee fuentes privadas ni almacena texto protegido. Su finalidad es
detectar huecos de procedencia antes de habilitar contenido respaldado por evidencia.
