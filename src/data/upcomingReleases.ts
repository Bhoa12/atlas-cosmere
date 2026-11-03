export interface ProximoLanzamiento {
  id: string;
  titulo: string;
  saga: string;
  fechaLanzamientoISO: string; // Formato AAAA-MM-DD
  descripcion: string;
  planeta: string;
  progresoEscrituraBrandon: number; // Porcentaje oficial
}

export const PROXIMOS_LANZAMIENTOS: ProximoLanzamiento[] = [
  {
    id: 'horneater',
    titulo: 'Comecuernos (Horneater)',
    saga: 'El Archivo de las Tormentas (Novela 4.5)',
    fechaLanzamientoISO: '2026-12-15T00:00:00Z',
    descripcion: 'La esperada novela centrada en Numuhukumakiaki\'aialunamor (Roca) regresando a los Picos de los Comecuernos.',
    planeta: 'Roshar',
    progresoEscrituraBrandon: 85
  },
  {
    id: 'whitesand_prose',
    titulo: 'Arena Blanca (Versión Novela en Prosa)',
    saga: 'Taldain',
    fechaLanzamientoISO: '2027-06-20T00:00:00Z',
    descripcion: 'Reescritura y canonización definitiva en formato novela de la historia de Kenton y Khriss.',
    planeta: 'Taldain',
    progresoEscrituraBrandon: 100
  },
  {
    id: 'ghostbloods_1',
    titulo: 'Nacidos de la Bruma Era 3: Ghostbloods 1',
    saga: 'Nacidos de la Bruma Era 3',
    fechaLanzamientoISO: '2028-12-08T00:00:00Z',
    descripcion: 'Thriller de espionaje tecnológico ambientado en un Scadrial con tecnología de principios de los años 80 e informática básica.',
    planeta: 'Scadrial',
    progresoEscrituraBrandon: 45
  },
  {
    id: 'elantris_2',
    titulo: 'Elantris 2',
    saga: 'Sel',
    fechaLanzamientoISO: '2029-10-15T00:00:00Z',
    descripcion: 'Secuela oficial explorando el impacto del nuevo AonDor en otras naciones de Sel como Fjorden.',
    planeta: 'Sel',
    progresoEscrituraBrandon: 15
  }
];