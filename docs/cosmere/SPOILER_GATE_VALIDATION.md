# Validación de puertas anti-spoilers

`validateCompositeSpoilerGates` valida la **estructura técnica** de puertas compuestas antes de usarlas para mostrar contenido.

Detecta IDs duplicados, puertas sin requisitos, referencias a obras desconocidas y requisitos repetidos. La validación recibe las obras conocidas como entrada: no busca coincidencias por título ni crea obras o checkpoints ausentes.

Esto mantiene una regla de fallo conservador: una dependencia editorial debe declararse y verificarse externamente antes de convertirse en metadatos. El módulo no lee EPUBs, no almacena texto protegido y no deduce relaciones narrativas.
