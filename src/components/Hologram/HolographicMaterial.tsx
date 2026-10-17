"use client";

import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import { useRef } from "react";

/**
 * Material holográfico customizado.
 *
 * Efeitos combinados:
 * - Fresnel rim light (borda brilhante, centro mais transparente — o clássico "hologram look")
 * - Scan lines verticais animadas
 * - Flicker (tremulação sutil de intensidade, como um holograma instável)
 * - Transparência aditiva (fica bonito sobre fundo escuro)
 */

const HolographicShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#4df3ff"), // ciano padrão estilo sci-fi; troque à vontade
    uFresnelPower: 2.2,
    uScanSpeed: 1.2,
    uScanDensity: 18.0,
    uFlickerIntensity: 0.08,
    uOpacity: 0.85,
  },
  // Vertex shader
  /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFresnelPower;
    uniform float uScanSpeed;
    uniform float uScanDensity;
    uniform float uFlickerIntensity;
    uniform float uOpacity;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      // Fresnel: quanto mais "de raspão" o ângulo de visão, mais brilha a borda
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), uFresnelPower);

      // Scan lines animadas verticalmente
      float scan = sin((vUv.y * uScanDensity) - uTime * uScanSpeed);
      scan = smoothstep(0.3, 1.0, scan) * 0.4;

      // Flicker sutil (tremulação)
      float flicker = 1.0 - uFlickerIntensity * sin(uTime * 25.0 + vUv.x * 10.0);

      float alpha = clamp((fresnel * 0.9 + scan) * flicker, 0.0, 1.0) * uOpacity;

      vec3 finalColor = uColor * (1.0 + fresnel * 1.5);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

extend({ HolographicShaderMaterial });

// Declaração de tipo pro JSX reconhecer <holographicShaderMaterial />
declare module "@react-three/fiber" {
  interface ThreeElements {
    holographicShaderMaterial: any;
  }
}

type HolographicMaterialProps = {
  color?: string;
  fresnelPower?: number;
  scanSpeed?: number;
  scanDensity?: number;
  flickerIntensity?: number;
  opacity?: number;
};

export function HolographicMaterial({
  color = "#4df3ff",
  fresnelPower = 2.2,
  scanSpeed = 1.2,
  scanDensity = 18,
  flickerIntensity = 0.08,
  opacity = 0.85,
}: HolographicMaterialProps) {
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.getElapsedTime();
    }
  });

  return (
    <holographicShaderMaterial
      ref={materialRef}
      uColor={new THREE.Color(color)}
      uFresnelPower={fresnelPower}
      uScanSpeed={scanSpeed}
      uScanDensity={scanDensity}
      uFlickerIntensity={flickerIntensity}
      uOpacity={opacity}
      transparent
      depthWrite={false}
      side={THREE.DoubleSide}
      blending={THREE.AdditiveBlending}
    />
  );
}
