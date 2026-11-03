export type CanonStatus = 'confirmed' | 'approximate' | 'unknown';

export type CelestialBodyType = 'star' | 'planet' | 'moon' | 'other';

/**
 * Astronomical facts and artistic presentation are deliberately separated.
 * Artistic coordinates must never be interpreted as canonical orbital data.
 */
export interface CelestialBody {
  id: string;
  name: string;
  type: CelestialBodyType;
  parentId?: string;
  visual: {
    textureKey?: string;
    atmosphereColor?: string;
    glowColor?: string;
  };
  artisticOrbit?: {
    radius: number;
    speed: number;
    inclination: number;
  };
  lore: {
    summary: string;
    relatedBooks: string[];
    canonStatus: CanonStatus;
  };
}

export interface ObservatorySystem {
  id: string;
  name: string;
  bodies: CelestialBody[];
  scaleMode: 'artistic';
}
