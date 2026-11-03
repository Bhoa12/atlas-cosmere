import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { SISTEMAS_COSMERE_COMPLETO } from '../../data/cosmereUniverse';

type GalaxySceneProps = {
  selectedSystemId?: string;
};

const StarField = () => {
  const geometry = useMemo(() => {
    const positions = new Float32Array(180 * 3);
    let seed = 918273;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 180; i += 1) {
      const radius = 3.5 + random() * 5.5;
      const angle = random() * Math.PI * 2;
      const height = (random() - 0.5) * 3.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return result;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#c7d6ef" size={0.035} transparent opacity={0.82} sizeAttenuation />
    </points>
  );
};

const GalaxyBody = ({ index, color, selected }: { index: number; color: string; selected: boolean }) => {
  const angle = (index / Math.max(SISTEMAS_COSMERE_COMPLETO.length, 1)) * Math.PI * 2;
  const radius = 2.15 + (index % 3) * 0.48;
  const position: [number, number, number] = [
    Math.cos(angle) * radius,
    Math.sin(index * 1.7) * 0.55,
    Math.sin(angle) * radius,
  ];
  const size = selected ? 0.22 : 0.14 + (index % 2) * 0.035;

  return (
    <group position={position}>
      {selected && (
        <mesh>
          <torusGeometry args={[size * 1.65, 0.018, 6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[size, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.15 : 0.35} roughness={0.7} metalness={0.08} />
      </mesh>
    </group>
  );
};

const GalaxyModel = ({ selectedSystemId }: GalaxySceneProps) => {
  const rotation = useRef<THREE.Group | null>(null);
  useFrame((_, delta) => {
    if (rotation.current) rotation.current.rotation.y += delta * 0.035;
  });

  return (
    <>
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 0, 0]} color="#f3d7a0" intensity={24} distance={12} />
      <StarField />
      <group ref={rotation}>
        <mesh>
          <sphereGeometry args={[0.46, 32, 32]} />
          <meshBasicMaterial color="#e8c98d" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshBasicMaterial color="#d6b477" transparent opacity={0.11} />
        </mesh>
        {[2.15, 2.63, 3.11].map((radius) => (
          <mesh key={radius} rotation={[Math.PI / 2.4, 0.15, 0]}>
            <torusGeometry args={[radius, 0.008, 4, 120]} />
            <meshBasicMaterial color="#9a8ab6" transparent opacity={0.24} />
          </mesh>
        ))}
        {SISTEMAS_COSMERE_COMPLETO.map((system, index) => (
          <GalaxyBody
            key={system.id}
            index={index}
            color={system.colorAura}
            selected={system.id === selectedSystemId}
          />
        ))}
      </group>
    </>
  );
};

export const GalaxyScene = ({ selectedSystemId }: GalaxySceneProps) => (
  <Canvas
    style={{ flex: 1, backgroundColor: '#080e1b' }}
    camera={{ position: [0, 0.8, 8.8], fov: 48, near: 0.1, far: 60 }}
    gl={{ antialias: true, alpha: false }}
    dpr={1}
  >
    <GalaxyModel selectedSystemId={selectedSystemId} />
  </Canvas>
);
