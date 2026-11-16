import React, { createContext, useContext, useEffect, useState } from 'react';
import { createExpoHoidProgressCoordinator } from '../hoid/expoProgressCoordinator';
import { atlasProgressFromSnapshot, HoidProgressCoordinator, type HoidProgressCoordinatorResult } from '../hoid/progressCoordinator';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { RANGOS_COSMERICOS, RangoCosmere } from '../data/gamification';
import { createEmptyAtlasReadingProgress } from '../hoid/initialProgress';

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
  progresoPersistenciaEstado: 'loading' | 'ready' | 'unavailable';
}

const CosmereContext = createContext<CosmereContextType | undefined>(undefined);

export const CosmereProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reinoCognitivoActivo, setReinoCognitivoActivo] = useState(false);
  // Progress is security-sensitive authorization data. Fresh profiles
  // start empty; demo fixtures must never be fed into Hoid's spoiler boundary.
  const [initialReadingProgress] = useState(createEmptyAtlasReadingProgress);
  const [librosLeidos, setLibrosLeidos] = useState(initialReadingProgress.completedByBook);
  const [capituloActualPorLibro, setCapituloActualPorLibro] = useState(initialReadingProgress.chaptersByBook);
  const [progresoPersistenciaEstado, setProgresoPersistenciaEstado] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [progressCoordinator, setProgressCoordinator] = useState<HoidProgressCoordinator | null>(null);

  const aplicarResultadoProgreso = (result: HoidProgressCoordinatorResult) => {
    if (result.status === 'ready' || result.status === 'conflict') {
      const restored = atlasProgressFromSnapshot(result.snapshot);
      setCapituloActualPorLibro(restored.chaptersByBook);
      setLibrosLeidos(restored.completedByBook);
      setProgresoPersistenciaEstado('ready');
    } else if (result.status === 'unavailable') {
      setProgresoPersistenciaEstado('unavailable');
    }
  };

  useEffect(() => {
    let mounted = true;
    createExpoHoidProgressCoordinator().then(async coordinator => {
      if (!mounted) return;
      setProgressCoordinator(coordinator);
      const result = await coordinator.initialize();
      if (mounted) aplicarResultadoProgreso(result);
    }).catch(() => {
      if (mounted) setProgresoPersistenciaEstado('unavailable');
    });

    return () => {
      mounted = false;
    };
  }, []);
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
    if (!progressCoordinator || progresoPersistenciaEstado !== 'ready') return;
    void progressCoordinator.setCompleted(libroId, !librosLeidos[libroId]).then(aplicarResultadoProgreso);
  };

  const setCapituloLibro = (libroId: string, cap: number) => {
    if (!progressCoordinator || progresoPersistenciaEstado !== 'ready') return;
    void progressCoordinator.setChapter(libroId, cap, {
      allowRegression: true,
      reopenCompleted: true,
    }).then(aplicarResultadoProgreso);
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
      todosLosLibrosLeidos,
      progresoPersistenciaEstado
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