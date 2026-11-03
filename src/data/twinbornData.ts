export interface MetalInfo {
  nombre: string;
  alomancia: string;
  feruquimia: string;
}

export const METALES_COSMERE: { [key: string]: MetalInfo } = {
  acero: { nombre: 'Acero', alomancia: 'Empujar metales', feruquimia: 'Almacenar velocidad física' },
  hierro: { nombre: 'Hierro', alomancia: 'Tirar de metales', feruquimia: 'Almacenar peso físico' },
  estano: { nombre: 'Estaño', alomancia: 'Agudizar sentidos', feruquimia: 'Almacenar agudeza sensorial' },
  peltre: { nombre: 'Peltre', alomancia: 'Fuerza física muscular', feruquimia: 'Almacenar vigor y salud' },
  cobre: { nombre: 'Cobre', alomancia: 'Nube de humo de pulsos', feruquimia: 'Almacenar recuerdos (Coppermind)' },
  bronce: { nombre: 'Bronce', alomancia: 'Detectar pulsos alománticos', feruquimia: 'Almacenar vigilia' },
  zinc: { nombre: 'Zinc', alomancia: 'Inflamar emociones', feruquimia: 'Almacenar velocidad mental' },
  laton: { nombre: 'Latón', alomancia: 'Apagar emociones', feruquimia: 'Almacenar calor corporal' },
  oro: { nombre: 'Oro', alomancia: 'Ver el pasado alternativo', feruquimia: 'Almacenar salud biológica profunda' },
  electrum: { nombre: 'Electrum', alomancia: 'Ver el propio futuro inmediato', feruquimia: 'Almacenar determinación' },
  duraluminio: { nombre: 'Duraluminio', alomancia: 'Quema súbita de reservas', feruquimia: 'Almacenar Conexión espiritual' },
  aluminio: { nombre: 'Aluminio', alomancia: 'Vaciar reservas de metales', feruquimia: 'Almacenar Identidad espiritual' },
  cadmio: { nombre: 'Cadmio', alomancia: 'Burbuja de tiempo lento', feruquimia: 'Almacenar respiración/oxígeno' },
  bendalloy: { nombre: 'Bendalloy', alomancia: 'Burbuja de tiempo veloz', feruquimia: 'Almacenar nutrición' },
  cromo: { nombre: 'Cromo', alomancia: 'Drenar alomancia ajena', feruquimia: 'Almacenar Fortuna/Suerte' },
  nicrosil: { nombre: 'Nicrosil', alomancia: 'Potenciar alomancia ajena', feruquimia: 'Almacenar Investidura directa' }
};

export interface ResonanciaTwinborn {
  nombreTitulo: string;
  efectoEspecial: string;
}

export function calcularResonancia(metalAlomancia: string, metalFeruquimia: string): ResonanciaTwinborn {
  // Composición pura (Compounding)
  if (metalAlomancia === metalFeruquimia) {
    return {
      nombreTitulo: `Compositor de ${METALES_COSMERE[metalAlomancia].nombre} (Compounder)`,
      efectoEspecial: '¡ACCESO A RESERVAS INFINITAS! Al quemar alománticamente una mente feruquímica, multiplicas el atributo por diez de forma inagotable (inmortalidad o fuerza infinita).'
    };
  }

  // Resonancias canónicas famosas
  if (metalAlomancia === 'acero' && metalFeruquimia === 'hierro') {
    return {
      nombreTitulo: 'Rompedor (Crashmaker)',
      efectoEspecial: 'Manipulación cinética extrema: puedes reducir tu peso a cero para saltar a velocidades supersónicas y aumentarlo a miles de kilos en pleno impacto.'
    };
  }

  if (metalAlomancia === 'bendalloy' && metalFeruquimia === 'oro') {
    return {
      nombreTitulo: 'Brumoso Sagrado',
      efectoEspecial: 'Curación acelerada dentro de burbujas temporales: te regeneras de heridas mortales en fracciones de segundo objetivo.'
    };
  }

  return {
    nombreTitulo: `Nacido Doble: ${METALES_COSMERE[metalAlomancia].nombre} / ${METALES_COSMERE[metalFeruquimia].nombre}`,
    efectoEspecial: `Resonancia armónica: Combina ${METALES_COSMERE[metalAlomancia].alomancia} con la capacidad de ${METALES_COSMERE[metalFeruquimia].feruquimia}.`
  };
}