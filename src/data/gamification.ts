export interface RangoCosmere {
  nivel: number;
  nombre: string;
  sagaOrigen: string;
  puntosMinimos: number;
  icono: string;
  color: string;
  lore: string;
  requiereTodosLosLibros?: boolean;
}

export const RANGOS_COSMERICOS: RangoCosmere[] = [
  { nivel: 1, nombre: 'Sin Aliento (Drab)', sagaOrigen: 'Nalthis', puntosMinimos: 0, icono: '🌑', color: '#64748b', lore: 'No tienes Aliento biocromático. Tu tono vital es gris y careces de Investidura activa.' },
  { nivel: 2, nombre: 'Ojo de Estaño (Tineye)', sagaOrigen: 'Scadrial', puntosMinimos: 400, icono: '👁️', color: '#94a3b8', lore: 'Quemas estaño. Tus sentidos se agudizan para detectar los primeros secretos del Cosmere.' },
  { nivel: 3, nombre: 'Forjador de Almas', sagaOrigen: 'Sel / Roshar', puntosMinimos: 1200, icono: '✨', color: '#10b981', lore: 'Puedes convencer a la esencia espiritual de las cosas para transformarse.' },
  { nivel: 4, nombre: 'Despertador del Quinto Aliento', sagaOrigen: 'Nalthis', puntosMinimos: 2500, icono: '🌈', color: '#ec4899', lore: 'Posees tono perfecto y reconocimiento instintivo de Investidura.' },
  { nivel: 5, nombre: 'Caballero Radiante (Tercer Ideal)', sagaOrigen: 'Roshar', puntosMinimos: 4500, icono: '⚡', color: '#38bdf8', lore: 'Has jurado las palabras. Tu esprec se manifiesta como una Hoja viva.' },
  { nivel: 6, nombre: 'Nacido de la Bruma Pleno', sagaOrigen: 'Scadrial', puntosMinimos: 7500, icono: '🔥', color: '#f59e0b', lore: 'Capaz de quemar los 16 metales. Las brumas te reconocen como su amo.' },
  { nivel: 7, nombre: 'Trotamundos de Silverlight', sagaOrigen: 'Reino Cognitivo', puntosMinimos: 11000, icono: '🌌', color: '#8b5cf6', lore: 'Navegas el mar de cuentas y conoces las rutas entre todos los mundos.' },
  { nivel: 8, nombre: 'Vaso de una Esquirla', sagaOrigen: 'Adonalsium', puntosMinimos: 16000, icono: '👑', color: '#eab308', lore: 'Controlas el poder primigenio de la Creación. Rango supremo e intranscendente.', requiereTodosLosLibros: true }
];

export interface Logro {
  id: string;
  titulo: string;
  descripcion: string;
  recompensaApodo: string;
  saga: string;
}

export const LOGROS_DISPONIBLES: Logro[] = [
  { id: '1', titulo: 'Superviviente de Hathsin', descripcion: 'Completar El Imperio Final', recompensaApodo: 'Superviviente de las Brumas', saga: 'Nacidos de la Bruma' },
  { id: '2', titulo: 'Hijo del Viento', descripcion: 'Leer El Camino de los Reyes', recompensaApodo: 'Corredor del Viento', saga: 'Archivo de las Tormentas' },
  { id: '3', titulo: 'Verdadera Iluminación', descripcion: 'Completar Palabras Radiantes', recompensaApodo: 'Tejedor de Luz', saga: 'Archivo de las Tormentas' },
  { id: '4', titulo: 'El Sello Perfecto', descripcion: 'Completar El Alma del Emperador', recompensaApodo: 'Forjador de Sellos', saga: 'Sel' },
  { id: '5', titulo: 'El Aliento de la Vida', descripcion: 'Completar Warbreaker', recompensaApodo: 'Devoto del Rey Dios', saga: 'Nalthis' },
  { id: '6', titulo: 'Maestro de Arenas', descripcion: 'Completar Arena Blanca', recompensaApodo: 'Lord Maestre del Diem', saga: 'Taldain' },
  { id: '7', titulo: 'Sangre de Espectro', descripcion: 'Leer El Metal Perdido e Historia Secreta', recompensaApodo: 'Agente de Thaidakar', saga: 'Cosmere' },
  { id: '8', titulo: 'Navegante de Esporas', descripcion: 'Leer Trenza del Mar Esmeralda', recompensaApodo: 'Capitán de Medianoche', saga: 'Novelas Secretas' },
  { id: '9', titulo: 'Portador del Amanecer', descripcion: 'Completar El Hombre Iluminado', recompensaApodo: 'El Hombre Iluminado', saga: 'Novelas Secretas' },
  { id: '10', titulo: 'Guardián de Religiones', descripcion: 'Alcanzar 2.000 Puntos en Tests', recompensaApodo: 'Guardián Terrisano', saga: 'Gamificación' },
  { id: '11', titulo: 'Ojo de Hierro', descripcion: 'Alcanzar 4.000 Puntos en Tests', recompensaApodo: 'Inquisidor de Acero', saga: 'Gamificación' },
  { id: '12', titulo: 'Erudito de Khriss', descripcion: 'Completar 10 Tests sin fallos', recompensaApodo: 'Erudito de Silverlight', saga: 'Gamificación' },
  { id: '13', titulo: 'Juramento Eterno', descripcion: 'Completar Juramentada y Ritmo de la Guerra', recompensaApodo: 'Forjador de Vínculos', saga: 'Archivo de las Tormentas' },
  { id: '14', titulo: 'Héroe de las Eras', descripcion: 'Completar toda la Era 1 de Scadrial', recompensaApodo: 'Héroe de las Eras', saga: 'Nacidos de la Bruma' },
  { id: '15', titulo: 'Ley y Plomo', descripcion: 'Completar toda la Era 2 de Scadrial', recompensaApodo: 'Justiciero de los Áridos', saga: 'Nacidos de la Bruma' },
  { id: '16', titulo: 'Sombra Inmortal', descripcion: 'Superar todos los tests de nivel avanzado', recompensaApodo: 'Sombra de Carbón', saga: 'Gamificación' }
];

export interface RosharReadingAchievement {
  id: string;
  workId?: string;
  requiredCompletedUnits?: number;
  requiresNarrativeCompletion?: boolean;
  title: string;
  description: string;
  reward: { type: 'nickname' | 'profile-frame' | 'profile-background'; id: string; label: string };
}

/**
 * Reading achievements are deterministic projections of explicit granular progress.
 * They never infer completion from legacy chapter counters or book toggles.
 */
export const ROSHAR_READING_ACHIEVEMENTS: RosharReadingAchievement[] = [
  {
    id: 'roshar-first-steps',
    requiredCompletedUnits: 1,
    title: 'Primer paso en Roshar',
    description: 'Completa tu primera unidad de lectura de Roshar.',
    reward: { type: 'nickname', id: 'roshar-explorer', label: 'Explorador de Roshar' }
  },
  {
    id: 'twok-narrative-complete',
    workId: 'twok',
    requiresNarrativeCompletion: true,
    title: 'Camino recorrido',
    description: 'Completa la historia narrativa de El Camino de los Reyes.',
    reward: { type: 'profile-frame', id: 'bridge-four', label: 'Marco Puente Cuatro' }
  }
];
