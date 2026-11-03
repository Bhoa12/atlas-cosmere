export interface MetalInfo {
  nombre: string;
  alomancia: string;
  feruquimia: string;
}

export const METALES_COSMERE: { [key: string]: MetalInfo } = {
  acero: { nombre: 'Acero', alomancia: 'Empujar metales', feruquimia: 'Almacenar velocidad física' },
  hierro: { nombre: 'Hierro', alomancia: 'Tirar de metales', feruquimia: 'Almacenar peso físico' },
  estano: { nombre: 'Estaño', alomancia: 'Agudizar sentidos', feruquimia: 'Almacenar agudeza sensorial' },
  peltre: { nombre: 'Peltre', alomancia: 'Aumentar fuerza física', feruquimia: 'Almacenar fuerza física' },
  cobre: { nombre: 'Cobre', alomancia: 'Ocultar pulsos alománticos', feruquimia: 'Almacenar recuerdos' },
  bronce: { nombre: 'Bronce', alomancia: 'Detectar pulsos alománticos', feruquimia: 'Almacenar vigilia' },
  zinc: { nombre: 'Zinc', alomancia: 'Avivar emociones', feruquimia: 'Almacenar velocidad mental' },
  laton: { nombre: 'Latón', alomancia: 'Calmar emociones', feruquimia: 'Almacenar calor corporal' },
  oro: { nombre: 'Oro', alomancia: 'Ver una versión alternativa de uno mismo', feruquimia: 'Almacenar salud' },
  electrum: { nombre: 'Electrum', alomancia: 'Ver posibles futuros propios', feruquimia: 'Almacenar determinación' },
  duraluminio: { nombre: 'Duraluminio', alomancia: 'Potenciar de golpe la quema de otros metales', feruquimia: 'Almacenar Conexión' },
  aluminio: { nombre: 'Aluminio', alomancia: 'Agotar las propias reservas alománticas', feruquimia: 'Almacenar Identidad' },
  cadmio: { nombre: 'Cadmio', alomancia: 'Crear una burbuja de tiempo ralentizado', feruquimia: 'Almacenar aliento' },
  bendalloy: { nombre: 'Bendalloy', alomancia: 'Crear una burbuja de tiempo acelerado', feruquimia: 'Almacenar nutrición' },
  cromo: { nombre: 'Cromo', alomancia: 'Drenar Investidura al tocar a alguien', feruquimia: 'Almacenar Fortuna' },
  nicrosil: { nombre: 'Nicrosil', alomancia: 'Potenciar la quema de metales de otra persona', feruquimia: 'Almacenar Investidura' }
};

export interface ResonanciaTwinborn {
  nombreTitulo: string;
  efectoEspecial: string;
}

export function calcularResonancia(metalAlomancia: string, metalFeruquimia: string): ResonanciaTwinborn {
  const alomancia = METALES_COSMERE[metalAlomancia];
  const feruquimia = METALES_COSMERE[metalFeruquimia];

  if (!alomancia || !feruquimia) {
    return {
      nombreTitulo: 'Combinación no válida',
      efectoEspecial: 'Selecciona un metal alomántico y uno feruquímico del catálogo.'
    };
  }

  if (metalAlomancia === metalFeruquimia) {
    return {
      nombreTitulo: `Nacido Doble compuesto de ${alomancia.nombre}`,
      efectoEspecial: `Puedes quemar tu propio metalmind de ${alomancia.nombre} para multiplicar el atributo almacenado. La amplificación consume el metalmind y no proporciona reservas infinitas por sí sola; su rendimiento depende de las reservas disponibles y de las reglas de la Composición.`
    };
  }

  return {
    nombreTitulo: `Nacido Doble: ${alomancia.nombre} / ${feruquimia.nombre}`,
    efectoEspecial: `Combinación de ${alomancia.alomancia.toLowerCase()} con ${feruquimia.feruquimia.toLowerCase()}. Esta ficha describe las dos capacidades individuales; no presupone una resonancia especial ni un efecto combinado confirmado para esta pareja.`
  };
}
