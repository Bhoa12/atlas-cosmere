export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const lenA = a.length;
  const lenB = b.length;

  for (let i = 0; i <= lenA; i++) matrix[i] = [i];
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // borrado
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  return matrix[lenA][lenB];
}

export function buscarConTolerancia<T>(
  lista: T[],
  campoTexto: (item: T) => string,
  consulta: string,
  umbralTolerancia: number = 2
): T[] {
  if (!consulta.trim()) return lista;
  const q = consulta.trim().toLowerCase();

  return lista.filter(item => {
    const texto = campoTexto(item).toLowerCase();
    if (texto.includes(q)) return true;
    
    // Comparar palabras individuales para tolerar nombres compuestos
    const palabras = texto.split(/\s+/);
    return palabras.some(palabra => levenshteinDistance(palabra, q) <= umbralTolerancia);
  });
}