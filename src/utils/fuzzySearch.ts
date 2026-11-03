function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const textoA = normalizarTexto(a);
  const textoB = normalizarTexto(b);
  if (textoA === textoB) return 0;
  if (!textoA.length) return textoB.length;
  if (!textoB.length) return textoA.length;

  // Memoria O(min(n, m)) en lugar de reservar una matriz completa.
  const corto = textoA.length <= textoB.length ? textoA : textoB;
  const largo = textoA.length <= textoB.length ? textoB : textoA;
  let anterior = Array.from({ length: corto.length + 1 }, (_, indice) => indice);

  for (let i = 1; i <= largo.length; i++) {
    const actual = [i];
    for (let j = 1; j <= corto.length; j++) {
      const coste = largo[i - 1] === corto[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + coste
      );
    }
    anterior = actual;
  }

  return anterior[corto.length];
}

export function buscarConTolerancia<T>(
  lista: T[],
  campoTexto: (item: T) => string,
  consulta: string,
  umbralTolerancia: number = 2
): T[] {
  const consultaNormalizada = normalizarTexto(consulta);
  if (!consultaNormalizada) return lista;

  const terminos = consultaNormalizada.split(/\s+/).filter(Boolean);
  return lista.filter(item => {
    const texto = normalizarTexto(campoTexto(item));
    if (texto.includes(consultaNormalizada)) return true;

    const palabras = texto.split(/\s+/).filter(Boolean);
    return terminos.every(termino => {
      const distanciaMaxima = Math.min(umbralTolerancia, termino.length <= 4 ? 1 : 2);
      return palabras.some(palabra =>
        palabra.includes(termino) || levenshteinDistance(palabra, termino) <= distanciaMaxima
      );
    });
  });
}
