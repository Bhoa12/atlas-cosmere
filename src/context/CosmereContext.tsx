import React, { createContext, useContext, useState } from 'react';
import { SISTEMAS_COSMERE_COMPLETO, Libro } from '../data/cosmereUniverse';
import { RANGOS_COSMERICOS, RangoCosmere } from '../data/gamification';

interface ComentarioComunidad {
  id: string;
  usuario: string;
  libroId: string;
  capituloMaximo: number;
  contenido: string;
  luzTormentosaLikes: number;
}

interface CosmereContextType {
  librosLeidos: { [libroId: string]: boolean };
  capituloActualPorLibro: { [libroId: string]: number };
  puntosInvestidura: number;
  rangoActual: RangoCosmere;
  apodoActivo: string;
  nombreUsuario: string;
  fondoActivo: string;
  comentarios: ComentarioComunidad[];
  toggleLibroLeido: (libroId: string) => void;
  setCapituloLibro: (libroId: string, cap: number) => void;
  sumarPuntos: (cantidad: number) => void;
  setApodoActivo: (apodo: string) => void;
  setNombreUsuario: (nombre: string) => void;
  setFondoActivo: (fondo: string) => void;
  agregarComentario: (libroId: string, capitulo: number, texto: string) => void;
  darLuzTormentosa: (comentarioId: string) => void;
  esContenidoDesbloqueado: (desbloqueoLibroId: string) => boolean;
}

const CosmereContext = createContext<CosmereContextType | undefined>(undefined);

export const CosmereProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado inicial con los primeros libros desbloqueados a modo de ejemplo
  const [librosLeidos, setLibrosLeidos] = useState<{ [libroId: string]: boolean }>({
    'tfe': true,
    'twok': true
  });
  const [capituloActualPorLibro, setCapituloActualPorLibro] = useState<{ [libroId: string]: number }>({
    'twok': 75,
    'wor': 15
  });
  const [puntosInvestidura, setPuntosInvestidura] = useState<number>(350);
  const [apodoActivo, setApodoActivo] = useState<string>('Ojo de Estaño');
  const [nombreUsuario, setNombreUsuario] = useState<string>('Viajero de Silverlight');
  const [fondoActivo, setFondoActivo] = useState<string>('#090d16');

  const [comentarios, setComentarios] = useState<ComentarioComunidad[]>([
    {
      id: 'c1',
      usuario: 'KholinScout',
      libroId: 'twok',
      capituloMaximo: 75,
      contenido: '¿Alguien más se dio cuenta de lo que dice el diagrama en las páginas preliminares?',
      luzTormentosaLikes: 12
    },
    {
      id: 'c2',
      usuario: 'Brumoso99',
      libroId: 'wor',
      capituloMaximo: 89,
      contenido: '¡El final con Szeth y esa espada parlante me dejó sin palabras!',
      luzTormentosaLikes: 25
    }
  ]);

  // Alternar si un libro está leído o no
  const toggleLibroLeido = (libroId: string) => {
    setLibrosLeidos(prev => {
      const nuevoEstado = !prev[libroId];
      if (nuevoEstado) sumarPuntos(100);
      return { ...prev, [libroId]: nuevoEstado };
    });
  };

  const setCapituloLibro = (libroId: string, cap: number) => {
    setCapituloActualPorLibro(prev => ({ ...prev, [libroId]: cap }));
  };

  const sumarPuntos = (cantidad: number) => {
    setPuntosInvestidura(prev => prev + cantidad);
  };

  // Calcular el rango automáticamente según los puntos acumulados
  const rangoActual = [...RANGOS_COSMERICOS]
    .reverse()
    .find(r => puntosInvestidura >= r.puntosMinimos) || RANGOS_COSMERICOS[0];

  // Comprobar si algo es spoiler
  const esContenidoDesbloqueado = (desbloqueoLibroId: string) => {
    return !!librosLeidos[desbloqueoLibroId];
  };

  const agregarComentario = (libroId: string, capitulo: number, texto: string) => {
    const nuevo: ComentarioComunidad = {
      id: Date.now().toString(),
      usuario: nombreUsuario,
      libroId,
      capituloMaximo: capitulo,
      contenido: texto,
      luzTormentosaLikes: 0
    };
    setComentarios([nuevo, ...comentarios]);
    sumarPuntos(20); // Recompensa por participar en la comunidad
  };

  const darLuzTormentosa = (id: string) => {
    setComentarios(prev => prev.map(c => c.id === id ? { ...c, luzTormentosaLikes: c.luzTormentosaLikes + 1 } : c));
  };

  return (
    <CosmereContext.Provider value={{
      librosLeidos,
      capituloActualPorLibro,
      puntosInvestidura,
      rangoActual,
      apodoActivo,
      nombreUsuario,
      fondoActivo,
      comentarios,
      toggleLibroLeido,
      setCapituloLibro,
      sumarPuntos,
      setApodoActivo,
      setNombreUsuario,
      setFondoActivo,
      agregarComentario,
      darLuzTormentosa,
      esContenidoDesbloqueado
    }}>
      {children}
    </CosmereContext.Provider>
  );
};

export const useCosmere = () => {
  const context = useContext(CosmereContext);
  if (!context) throw new Error('useCosmere debe usarse dentro de CosmereProvider');
  return context;
};