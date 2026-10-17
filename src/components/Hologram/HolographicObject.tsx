"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { memo, useEffect, useMemo, useRef, Suspense } from "react";
import * as THREE from "three";
import { HolographicMaterial } from "./HolographicMaterial";

/**
 * <HolographicObject /> — cena 3D completa, pronta pra ser colocada em
 * qualquer lugar do jogo (menu, HUD, loading screen, etc).
 *
 * Uso básico (forma primitiva, sem precisar de modelo externo):
 *
 *   <HolographicObject shape="icosahedron" />
 *
 * Uso com modelo 3D próprio (.glb/.gltf dentro de /public/models/):
 *
 *   <HolographicObject modelPath="/models/nave.glb" />
 *
 * Em qualquer um dos casos, o componente já cuida de:
 * - canvas transparente (fica sobre o fundo do jogo)
 * - rotação automática
 * - luz mínima (o shader já se auto-ilumina, mas um pouco de ambient ajuda o grid)
 */

type Shape = "icosahedron" | "box" | "torus" | "sphere";

function RotatingMesh({
  shape,
  color,
}: {
  shape: Shape;
  color?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
      meshRef.current.rotation.x += delta * 0.15;
    }
  });

  const geometry = (() => {
    switch (shape) {
      case "box":
        return <boxGeometry args={[1.4, 1.4, 1.4]} />;
      case "torus":
        return <torusGeometry args={[1, 0.35, 32, 100]} />;
      case "sphere":
        return <sphereGeometry args={[1.2, 48, 48]} />;
      case "icosahedron":
      default:
        return <icosahedronGeometry args={[1.3, 1]} />;
    }
  })();

  return (
    <mesh ref={meshRef}>
      {geometry}
      <HolographicMaterial color={color} />
    </mesh>
  );
}

function RotatingModel({ modelPath, color }: { modelPath: string; color?: string }) {
  // useGLTF faz cache interno por modelPath, então o modelo em si não é
  // baixado/decodificado de novo a cada render — isso já estava correto.
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  // O material é criado UMA ÚNICA VEZ (useMemo), não a cada re-render.
  // Antes, isso rodava toda vez que o React re-renderizava o componente
  // (o que acontece dezenas de vezes por segundo durante animações do jogo),
  // criando um THREE.Material novo a cada vez sem nunca descartar o antigo —
  // isso ia empilhando lixo na GPU e travava o navegador em poucos segundos.
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: color ?? "#4df3ff",
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );

  // Aplica o material holográfico em todas as malhas do modelo.
  // Roda só quando a cena ou o material realmente mudam (useEffect),
  // nunca a cada frame/render.
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });
  }, [scene, material]);

  // Descarta o material da memória da GPU quando o componente sai de tela
  // (ex: quando a carta sai do campo) ou quando a cor muda.
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

type HolographicObjectProps = {
  shape?: Shape;
  modelPath?: string;
  color?: string;
  height?: number | string;
  background?: string;
};

function HolographicObjectImpl({
  shape = "icosahedron",
  modelPath,
  color = "#4df3ff",
  height = 320,
  background = "transparent",
}: HolographicObjectProps) {
  return (
    <div style={{ width: "100%", height, background }}>
      <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} gl={{ alpha: true }} frameloop="always" dpr={[1, 1.5]}>
        <ambientLight intensity={0.3} />
        <Suspense fallback={null}>
          {modelPath ? (
            <RotatingModel modelPath={modelPath} color={color} />
          ) : (
            <RotatingMesh shape={shape} color={color} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

// memo: o jogo re-renderiza a tela de duelo com muita frequência (pontos de
// vida contando, popups de dano, câmera balançando). Sem o memo, cada uma
// dessas atualizações recriaria todo o canvas 3D do dragão à toa. Com o
// memo, o componente só re-renderiza se shape/modelPath/color/height mudarem.
const HolographicObject = memo(HolographicObjectImpl);
export default HolographicObject;