"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Holograma de um modelo .glb que se enquadra sozinho (mede, centraliza e ajusta o tamanho).
 *
 * Desempenho:
 * - quality="mini" (zona do campo): 30 fps, sem antialias, resolução 1x.
 * - quality="full" (cena de invocação): 60 fps, resolução até 1,5x.
 * - preloadHologram() carrega e processa o .glb antes da invocação, para não travar na hora.
 */

export function preloadHologram(modelPath: string) {
  useGLTF.preload(modelPath);
}

interface Props {
  modelPath: string;
  color?: string;
  height?: number | string;
  spin?: boolean;
  intro?: boolean; // "materializa": sobe e cresce ao aparecer (1,3 s)
  quality?: "mini" | "full";
}

const ADD = THREE.AdditiveBlending;

function Model({ modelPath, color, spin, intro }: { modelPath: string; color: string; spin: boolean; intro: boolean }) {
  const { scene } = useGLTF(modelPath);
  const riseRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);

  // Mede o modelo uma vez: escala para caber num cubo de lado 2 e centraliza na origem.
  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = 2 / (Math.max(size.x, size.y, size.z) || 1);
    return { s, pos: center.multiplyScalar(-s) };
  }, [scene]);

  useFrame((_, dt) => {
    elapsed.current += dt;
    const t = elapsed.current;
    if (spin && spinRef.current) spinRef.current.rotation.y += dt * 0.6;
    if (intro && riseRef.current) {
      const k = Math.min(t / 1.3, 1);
      const e = 1 - Math.pow(1 - k, 3);
      riseRef.current.scale.setScalar(0.3 + 0.7 * e);
      riseRef.current.position.y = -0.6 + 0.6 * e;
    }
    // anel de varredura sobe e desce pelo modelo
    if (scanRef.current) scanRef.current.position.y = -1 + 2 * (0.5 + 0.5 * Math.sin(t * 1.8));
  });

  return (
    <group ref={riseRef}>
      <group ref={spinRef}>
        <group position={fit.pos} scale={fit.s}>
          <Clone object={scene} inject={<meshBasicMaterial color={color} transparent opacity={0.28} blending={ADD} depthWrite={false} side={THREE.DoubleSide} />} />
          <Clone object={scene} inject={<meshBasicMaterial color={color} wireframe transparent opacity={0.5} blending={ADD} depthWrite={false} />} />
        </group>
      </group>

      {/* anel que varre o modelo de baixo para cima */}
      <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 0.98, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} blending={ADD} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* base luminosa, como um projetor de holograma */}
      <mesh position={[0, -1.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.95, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} blending={ADD} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -1.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.98, 1.03, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} blending={ADD} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** No modo "demand" o canvas só desenha quando mandamos: limita a ~30 fps. */
function Ticker({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(id);
  }, [invalidate, fps]);
  return null;
}

export default function FittedHologram({ modelPath, color = "#4df3ff", height = "100%", spin = true, intro = false, quality = "full" }: Props) {
  const mini = quality === "mini";
  return (
    <div style={{ width: "100%", height }}>
      <Canvas
        camera={{ position: [0, 0.9, 3.7], fov: 40 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        frameloop={mini ? "demand" : "always"}
        gl={{ alpha: true, antialias: !mini, powerPreference: "high-performance" }}
        dpr={mini ? 1 : [1, 1.5]}
      >
        {mini && <Ticker fps={30} />}
        <Suspense fallback={null}>
          <Model modelPath={modelPath} color={color} spin={spin} intro={intro} />
        </Suspense>
      </Canvas>
    </div>
  );
}
