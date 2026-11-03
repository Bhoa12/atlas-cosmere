import React, { useMemo, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { SISTEMAS_COSMERE_COMPLETO } from '../../data/cosmereUniverse';

type ViewMode = 'galaxy' | 'system';
type GalaxySceneProps = {
  selectedSystemId?: string;
  focusedSystemId?: string;
  onSelectSystem?: (systemId: string) => void;
  onReset?: () => void;
  viewMode?: ViewMode;
};
type CameraRig = { yaw: number; pitch: number; distance: number };

const DEFAULT_CAMERA: CameraRig = { yaw: 0, pitch: 0.09, distance: 8.8 };
const MIN_DISTANCE = 4.5;
const MAX_DISTANCE = 15;

const getSystemPosition = (index: number): [number, number, number] => {
  const angle = (index / Math.max(SISTEMAS_COSMERE_COMPLETO.length, 1)) * Math.PI * 2;
  const radius = 2.15 + (index % 3) * 0.48;
  return [Math.cos(angle) * radius, Math.sin(index * 1.7) * 0.55, Math.sin(angle) * radius];
};

const touchDistance = (event: GestureResponderEvent) => {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return null;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
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
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (random() - 0.5) * 3.5;
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

const GalaxyBody = ({ index, color, selected, systemId }: {
  index: number; color: string; selected: boolean; systemId: string;
}) => {
  const position = getSystemPosition(index);
  const size = selected ? 0.22 : 0.14 + (index % 2) * 0.035;

  return (
    <group position={position}>
      <mesh userData={{ systemId }}>
        <sphereGeometry args={[0.34, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh>
          <torusGeometry args={[size * 1.65, 0.018, 6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      )}
      <mesh userData={{ systemId }}>
        <sphereGeometry args={[size, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.15 : 0.35} roughness={0.7} metalness={0.08} />
      </mesh>
    </group>
  );
};

const GalaxyModel = ({
  selectedSystemId,
  focusedSystemId,
  viewMode,
  cameraRig,
  cameraRef,
  sceneRef,
}: {
  selectedSystemId?: string;
  focusedSystemId?: string;
  viewMode: ViewMode;
  cameraRig: React.MutableRefObject<CameraRig>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
}) => {
  const rotation = useRef<THREE.Group | null>(null);
  const { camera, scene } = useThree();
  cameraRef.current = camera;
  sceneRef.current = scene;

  useFrame((_, delta) => {
    const focusedIndex = SISTEMAS_COSMERE_COMPLETO.findIndex((system) => system.id === focusedSystemId);
    if (rotation.current) {
      rotation.current.rotation.y = focusedIndex >= 0 ? 0 : rotation.current.rotation.y + delta * 0.018;
    }

    const { yaw, pitch, distance } = cameraRig.current;
    const horizontal = Math.cos(pitch) * distance;
    const direction = new THREE.Vector3(
      Math.sin(yaw) * horizontal,
      Math.sin(pitch) * distance,
      Math.cos(yaw) * horizontal,
    ).normalize();

    let target = new THREE.Vector3(0, 0, 0);
    let cameraDistance = distance;
    if (viewMode === 'system') {
      cameraDistance = 5.2;
    } else if (focusedIndex >= 0) {
      target = new THREE.Vector3(...getSystemPosition(focusedIndex));
      cameraDistance = 1.35;
    }
    camera.position.copy(target).add(direction.multiplyScalar(cameraDistance));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
  });

  return (
    <>
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 0, 0]} color="#f3d7a0" intensity={24} distance={12} />
      <StarField />
      <group ref={rotation}>
        {viewMode === 'galaxy' ? (
          <>
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
              <GalaxyBody key={system.id} index={index} systemId={system.id}
                color={system.colorAura} selected={system.id === selectedSystemId} />
            ))}
          </>
        ) : (
          <group>
            <mesh>
              <sphereGeometry args={[0.42, 32, 32]} />
              <meshBasicMaterial color="#e8c98d" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.7, 32, 32]} />
              <meshBasicMaterial color="#d6b477" transparent opacity={0.1} />
            </mesh>
            {[1.15, 1.75, 2.35].map((radius) => (
              <mesh key={radius} rotation={[Math.PI / 2.3, 0.12, 0]}>
                <torusGeometry args={[radius, 0.009, 4, 100]} />
                <meshBasicMaterial color="#9a8ab6" transparent opacity={0.42} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </>
  );
};

export const GalaxyScene = ({
  selectedSystemId,
  focusedSystemId,
  onSelectSystem,
  onReset,
  viewMode = 'galaxy',
}: GalaxySceneProps) => {
  const cameraRig = useRef<CameraRig>({ ...DEFAULT_CAMERA });
  const dragOrigin = useRef({ yaw: 0, pitch: 0, dx: 0, dy: 0 });
  const pinchOrigin = useRef<{ distance: number; zoom: number } | null>(null);
  const previousTouchCount = useRef(0);
  const touchCountOnGrant = useRef(0);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stageSize = useRef({ width: 1, height: 1 });
  const raycaster = useRef(new THREE.Raycaster());
  const viewModeRef = useRef(viewMode);
  const selectRef = useRef(onSelectSystem);
  viewModeRef.current = viewMode;
  selectRef.current = onSelectSystem;

  const handleGrant = (event: GestureResponderEvent) => {
    dragOrigin.current = { yaw: cameraRig.current.yaw, pitch: cameraRig.current.pitch, dx: 0, dy: 0 };
    const distance = touchDistance(event);
    pinchOrigin.current = distance === null ? null : { distance, zoom: cameraRig.current.distance };
    previousTouchCount.current = event.nativeEvent.touches.length;
    touchCountOnGrant.current = event.nativeEvent.touches.length;
  };

  const handleMove = (event: GestureResponderEvent, gesture: PanResponderGestureState) => {
    const count = event.nativeEvent.touches.length;
    if (count >= 2) {
      const distance = touchDistance(event);
      if (distance !== null) {
        if (previousTouchCount.current < 2 || !pinchOrigin.current) {
          pinchOrigin.current = { distance, zoom: cameraRig.current.distance };
        } else {
          cameraRig.current.distance = THREE.MathUtils.clamp(
            pinchOrigin.current.zoom * (pinchOrigin.current.distance / Math.max(distance, 1)),
            MIN_DISTANCE,
            MAX_DISTANCE,
          );
        }
      }
    } else if (count === 1) {
      if (previousTouchCount.current >= 2) {
        dragOrigin.current = {
          yaw: cameraRig.current.yaw, pitch: cameraRig.current.pitch, dx: gesture.dx, dy: gesture.dy,
        };
      }
      cameraRig.current.yaw = dragOrigin.current.yaw + (gesture.dx - dragOrigin.current.dx) * 0.006;
      cameraRig.current.pitch = THREE.MathUtils.clamp(
        dragOrigin.current.pitch + (gesture.dy - dragOrigin.current.dy) * 0.004,
        -1.05,
        1.05,
      );
      pinchOrigin.current = null;
    }
    previousTouchCount.current = count;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: (event, gesture) => {
        if (
          viewModeRef.current === 'galaxy'
          && touchCountOnGrant.current === 1
          && Math.abs(gesture.dx) < 12
          && Math.abs(gesture.dy) < 12
          && cameraRef.current
          && sceneRef.current
        ) {
          const { width, height } = stageSize.current;
          const pointer = new THREE.Vector2(
            (event.nativeEvent.locationX / width) * 2 - 1,
            -(event.nativeEvent.locationY / height) * 2 + 1,
          );
          raycaster.current.setFromCamera(pointer, cameraRef.current);
          const hits = raycaster.current.intersectObjects(sceneRef.current.children, true);
          const hit = hits.find((item) => typeof item.object.userData.systemId === 'string');
          if (hit) selectRef.current?.(hit.object.userData.systemId as string);
        }
        pinchOrigin.current = null;
        previousTouchCount.current = 0;
        touchCountOnGrant.current = 0;
      },
      onPanResponderTerminate: () => {
        pinchOrigin.current = null;
        previousTouchCount.current = 0;
        touchCountOnGrant.current = 0;
      },
    }),
  ).current;

  const resetCamera = () => {
    cameraRig.current = { ...DEFAULT_CAMERA };
    dragOrigin.current = { yaw: DEFAULT_CAMERA.yaw, pitch: DEFAULT_CAMERA.pitch, dx: 0, dy: 0 };
    pinchOrigin.current = null;
    onReset?.();
  };

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        stageSize.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
      }}
      {...panResponder.panHandlers}
    >
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0.8, DEFAULT_CAMERA.distance], fov: 48, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={1}
      >
        <GalaxyModel
          selectedSystemId={selectedSystemId}
          focusedSystemId={focusedSystemId}
          viewMode={viewMode}
          cameraRig={cameraRig}
          cameraRef={cameraRef}
          sceneRef={sceneRef}
        />
      </Canvas>
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>
          {viewMode === 'galaxy'
            ? 'TOCA UN SISTEMA · ARRASTRA PARA ROTAR · PINZA PARA ZOOM'
            : 'ESQUEMA ARTÍSTICO · CUERPOS AÚN NO CATALOGADOS'}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={viewMode === 'system' ? 'Volver a la galaxia' : 'Restablecer cámara'}
        onPress={resetCamera}
        style={styles.resetButton}
      >
        <Text style={styles.resetText}>↺ {viewMode === 'system' ? 'VOLVER A GALAXIA' : 'REENCUADRAR'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080e1b' },
  canvas: { flex: 1, backgroundColor: '#080e1b' },
  hint: { position: 'absolute', top: 8, alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#080e1bcc' },
  hintText: { color: '#aab7ca', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  resetButton: { position: 'absolute', right: 9, bottom: 9, borderRadius: 14, borderWidth: 1, borderColor: '#756449', backgroundColor: '#101a2aef', paddingHorizontal: 11, paddingVertical: 8 },
  resetText: { color: '#d6b477', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});
