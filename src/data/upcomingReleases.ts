export interface ProximoLanzamiento {
  id: string;
  titulo: string;
  saga: string;
  fechaLanzamientoISO: string | null;
  descripcion: string;
  planeta: string;
  progresoEscrituraBrandon: number | null;
  estado: string;
  fuente: string;
}

export const PROXIMOS_LANZAMIENTOS: ProximoLanzamiento[] = [
  {
    id: 'fires_of_december',
    titulo: 'The Fires of December',
    saga: 'Cosmere · Novela independiente narrada por Hoid',
    fechaLanzamientoISO: null,
    descripcion: 'Novela independiente del Cosmere anunciada para edición comercial en diciembre de 2026. La fecha exacta puede variar según la edición y el mercado.',
    planeta: 'Cosmere',
    progresoEscrituraBrandon: null,
    estado: 'Diciembre de 2026 · mes anunciado',
    fuente: 'https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025'
  },
  {
    id: 'ghostbloods_1',
    titulo: 'Mistborn: Ghostbloods 1',
    saga: 'Nacidos de la Bruma · Era 3',
    fechaLanzamientoISO: null,
    descripcion: 'Primera novela de la siguiente era de Nacidos de la Bruma.',
    planeta: 'Scadrial',
    progresoEscrituraBrandon: null,
    estado: 'Diciembre de 2028 · ventana prevista',
    fuente: 'https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025'
  },
  {
    id: 'elantris_2',
    titulo: 'Elantris 2',
    saga: 'Elantris',
    fechaLanzamientoISO: null,
    descripcion: 'Secuela prevista, sin fecha de publicación confirmada en la actualización oficial consultada.',
    planeta: 'Sel',
    progresoEscrituraBrandon: null,
    estado: 'Sin fecha confirmada',
    fuente: 'https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025'
  },
  {
    id: 'horneater',
    titulo: 'Horneater',
    saga: 'El Archivo de las Tormentas · Novela 4.5',
    fechaLanzamientoISO: null,
    descripcion: 'Novela centrada en Roca. No se debe presentar una fecha anterior como confirmada sin una actualización oficial vigente.',
    planeta: 'Roshar',
    progresoEscrituraBrandon: null,
    estado: 'Sin fecha confirmada',
    fuente: 'https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025'
  }
];
