export interface RangoCosmere {
  nivel: number;
  nombre: string;
  sagaOrigen: string;
  puntosMinimos: number;
  icono: string;
  color: string;
  lore: string;
}

export const RANGOS_COSMERICOS: RangoCosmere[] = [
  { nivel: 1, nombre: 'Sin Aliento (Drab)', sagaOrigen: 'Nalthis', puntosMinimos: 0, icono: '🌑', color: '#64748b', lore: 'No tienes Aliento biocromático. Tu tono vital es gris y careces de Investidura activa.' },
  { nivel: 2, nombre: 'Ojo de Estaño (Tineye)', sagaOrigen: 'Scadrial', puntosMinimos: 200, icono: '👁️', color: '#94a3b8', lore: 'Quemas estaño. Tus sentidos se agudizan para detectar los primeros secretos del Cosmere.' },
  { nivel: 3, nombre: 'Forjador de Almas (Soulcaster)', sagaOrigen: 'Sel / Roshar', puntosMinimos: 600, icono: '✨', color: '#10b981', lore: 'Puedes convencer a la esencia espiritual de las cosas para transformarse.' },
  { nivel: 4, nombre: 'Despertador del Quinto Aliento', sagaOrigen: 'Nalthis', puntosMinimos: 1200, icono: '🌈', color: '#ec4899', lore: 'Posees tono perfecto y reconocimiento instintivo de Investidura.' },
  { nivel: 5, nombre: 'Caballero Radiante (Tercer Ideal)', sagaOrigen: 'Roshar', puntosMinimos: 2200, icono: '⚡', color: '#38bdf8', lore: 'Has jurado las palabras. Tu esprec se manifiesta como una Hoja de Esquirla viva.' },
  { nivel: 6, nombre: 'Nacido de la Bruma Pleno', sagaOrigen: 'Scadrial', puntosMinimos: 3800, icono: '🔥', color: '#f59e0b', lore: 'Capaz de quemar los dieciséis metales. Las brumas te reconocen como su amo.' },
  { nivel: 7, nombre: 'Viajesombras de Silverlight', sagaOrigen: 'El Reino Cognitivo', puntosMinimos: 6000, icono: '🌌', color: '#8b5cf6', lore: 'Navegas el mar de cuentas y conoces las rutas entre todos los mundos habitados.' },
  { nivel: 8, nombre: 'Vaso de una Esquirla', sagaOrigen: 'Adonalsium', puntosMinimos: 10000, icono: '👑', color: '#eab308', lore: 'Has tomado el manto de una Esquirla primigenia. La realidad se pliega a tu voluntad.' }
];

export interface Logro {
  id: string;
  titulo: string;
  descripcion: string;
  recompensaApodo: string;
  recompensaFondo: string;
  desbloqueadoPorPuntos?: number;
}

export const LOGROS_DISPONIBLES: Logro[] = [
  { id: 'era1_master', titulo: 'Superviviente de las Brumas', descripcion: 'Completar la trilogía original de Nacidos de la Bruma.', recompensaApodo: 'Superviviente de Hathsin', recompensaFondo: '#0f172a' },
  { id: 'stormlight_vessel', titulo: 'Hijo del Honor', descripcion: 'Leer los 5 tomos principales de El Archivo de las Tormentas.', recompensaApodo: 'Portador de Tormentas', recompensaFondo: '#0c4a6e' },
  { id: 'quiz_god', titulo: 'Mente de Cephandrius', descripcion: 'Alcanzar más de 2000 puntos en los Tests de la IA.', recompensaApodo: 'Bufón Erudito', recompensaFondo: '#311042' }
];