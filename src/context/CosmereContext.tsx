import React, { createContext, useContext, useState } from 'react';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { RANGOS_COSMERICOS, RangoCosmere } from '../data/gamification';

interface ComentarioComunidad {
  id: string;
  usuario: string;
  sagaId: string;
  libroId: string;
  capituloMaximo: number;
  contenido: string;
  luzTormentosaLikes: number;
}

interface CosmereContextType {
  reinoCognitivoActivo: boolean; // INTERRUPTOR DE SHADESMAR
  librosLeidos: { [libroId: string]: boolean };
  capituloActualPorLibro: { [libroId: string]: number };
  puntosInvestidura: number;
  rangoActual: RangoCosmere;
  apodoActivo: string;
  nombreUsuario: string;
  comentarios: ComentarioComunidad[];
  testsCompletadosExitosos: { [testId: string]: boolean };
  toggleReinoCognitivo: () => void;
  toggleLibroLeido: (libroId: string) => void;
  setCapituloLibro: (libroId: string, cap: number) => void;
  sumarPuntosTestUnico: (testId: string, puntos: number) => boolean;
  setApodoActivo: (apodo: string) => void;
  setNombreUsuario: (nombre: string) => void;
  agregarComentario: (sagaId: string, libroId: string, capitulo: number, texto: string) => void;
  darLuzTormentosa: (comentarioId: string) => void;
  esContenidoDesbloqueado: (desbloqueoLibroId: string) => boolean;
  todosLosLibrosLeidos: boolean;
}

const CosmereContext = createContext<CosmereContextType | undefined>(undefined);

export const CosmereProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reinoCognitivoActivo, setReinoCognitivoActivo] = useState(false);
  const [librosLeidos, setLibrosLeidos] = useState<{ [libroId: string]: boolean }>({
    'tfe': true,
    'twok': true
  });
  const [capituloActualPorLibro, setCapituloActualPorLibro] = useState<{ [libroId: string]: number }>({
    'twok': 75,
    'tfe': 38
  });
  const [puntosInvestidura, setPuntosInvestidura] = useState<number>(450);
  const [apodoActivo, setApodoActivo] = useState<string>('Ojo de Estaño');
  const [nombreUsuario, setNombreUsuario] = useState<string>('Trotamundos de Silverlight');
  const [testsCompletadosExitosos, setTestsCompletadosExitosos] = useState<{ [testId: string]: boolean }>({});

  const [comentarios, setComentarios] = useState<ComentarioComunidad[]>([
    {
      id: 'c1',
      usuario: 'KholinScout',
      sagaId: 'Archivo de las Tormentas',
      libroId: 'twok',
      capituloMaximo: 75,
      contenido: 'El puente cuatro saltando el abismo al final sigue poniéndome la piel de gallina.',
      luzTormentosaLikes: 34
    }
  ]);

  const toggleReinoCognitivo = () => {
    setReinoCognitivoActivo(prev => !prev);
  };

  const totalLibrosEnUniverso = SISTEMAS_COSMERE_COMPLETO.reduce((acc, sis) => acc + sis.libros.length, 0);
  const totalLeidosCount = Object.values(librosLeidos).filter(Boolean).length;
  const todosLosLibrosLeidos = totalLeidosCount >= totalLibrosEnUniverso;

  const toggleLibroLeido = (libroId: string) => {
    setLibrosLeidos(prev => ({ ...prev, [libroId]: !prev[libroId] }));
  };

  const setCapituloLibro = (libroId: string, cap: number) => {
    setCapituloActualPorLibro(prev => ({ ...prev, [libroId]: cap }));
  };

  const sumarPuntosTestUnico = (testId: string, puntos: number): boolean => {
    if (testsCompletadosExitosos[testId]) return false;
    setTestsCompletadosExitosos(prev => ({ ...prev, [testId]: true }));
    setPuntosInvestidura(prev => prev + puntos);
    return true;
  };

  const rangoActual = (() => {
    const rangosOrdenados = [...RANGOS_COSMERICOS].reverse();
    for (const r of rangosOrdenados) {
      if (puntosInvestidura >= r.puntosMinimos) {
        if (r.requiereTodosLosLibros && !todosLosLibrosLeidos) continue;
        return r;
      }
    }
    return RANGOS_COSMERICOS[0];
  })();

  const esContenidoDesbloqueado = (desbloqueoLibroId: string) => !!librosLeidos[desbloqueoLibroId];

  const agregarComentario = (sagaId: string, libroId: string, capitulo: number, texto: string) => {
    const nuevo: ComentarioComunidad = {
      id: Date.now().toString(),
      usuario: nombreUsuario,
      sagaId,
      libroId,
      capituloMaximo: capitulo,
      contenido: texto,
      luzTormentosaLikes: 0
    };
    setComentarios([nuevo, ...comentarios]);
  };

  const darLuzTormentosa = (id: string) => {
    setComentarios(prev => prev.map(c => c.id === id ? { ...c, luzTormentosaLikes: c.luzTormentosaLikes + 1 } : c));
  };

  return (
    <CosmereContext.Provider value={{
      reinoCognitivoActivo,
      librosLeidos,
      capituloActualPorLibro,
      puntosInvestidura,
      rangoActual,
      apodoActivo,
      nombreUsuario,
      comentarios,
      testsCompletadosExitosos,
      toggleReinoCognitivo,
      toggleLibroLeido,
      setCapituloLibro,
      sumarPuntosTestUnico,
      setApodoActivo,
      setNombreUsuario,
      agregarComentario,
      darLuzTormentosa,
      esContenidoDesbloqueado,
      todosLosLibrosLeidos
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