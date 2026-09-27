"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, OrbitControls, useGLTF } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { BodyRegion, ResultAnatomy } from "@/lib/result-anatomy";

const HIGHLIGHT = "#f2b84b";
const BONE = "#e8d8bd";

function active(regions: BodyRegion[], region: BodyRegion) {
  return regions.includes(region);
}

function Material({ highlighted, color, opacity = 1 }: { highlighted: boolean; color: string; opacity?: number }) {
  return <meshPhysicalMaterial color={highlighted ? HIGHLIGHT : color} emissive={highlighted ? HIGHLIGHT : "#000000"} emissiveIntensity={highlighted ? 1.25 : 0} roughness={0.5} metalness={0.02} transparent opacity={highlighted ? 0.95 : opacity} depthWrite={highlighted} />;
}

function Pulse({ position, color = HIGHLIGHT, scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  const reference = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!reference.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2 + position[1]) * 0.16;
    reference.current.scale.setScalar(scale * pulse);
  });
  return <mesh ref={reference} position={position}><sphereGeometry args={[0.09, 20, 20]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>;
}

function RealHumanShell() {
  const { scene } = useGLTF("/models/bodyparts3d/human-skin.glb");

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.3;
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
        material.color.set("#b97872");
      });
    });
  }, [scene]);

  return <primitive object={scene} position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.00155} />;
}

useGLTF.preload("/models/bodyparts3d/human-skin.glb");

function HumanFigure({ anatomy }: { anatomy: ResultAnatomy }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.12;
  });
  const regions = anatomy.regions;
  const bloodActive = active(regions, "blood");
  const marrowActive = active(regions, "bone-marrow");
  const organActive = (region: BodyRegion) => active(regions, region);

  return (
    <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.12}>
      <group ref={group} position={[0, -0.12, 0]}>
        <RealHumanShell />

        <group position={[0, 1.48, 0.18]}>
          <mesh position={[0, 0.23, 0]}><sphereGeometry args={[0.2, 24, 16]} /><Material highlighted={organActive("brain")} color="#c77b9a" /></mesh>
          <mesh position={[-0.18, -0.14, 0]} rotation={[0, 0, -0.18]}><capsuleGeometry args={[0.16, 0.48, 8, 16]} /><Material highlighted={organActive("blood")} color="#a94d63" /></mesh>
          <mesh position={[0.18, -0.14, 0]} rotation={[0, 0, 0.18]}><capsuleGeometry args={[0.16, 0.48, 8, 16]} /><Material highlighted={organActive("blood")} color="#a94d63" /></mesh>
          <mesh position={[0, -0.03, 0.11]}><sphereGeometry args={[0.07, 20, 16]} /><Material highlighted={bloodActive} color="#d64f57" /></mesh>
          <mesh position={[0, -0.23, 0.02]} scale={[1.2, 0.7, 0.6]}><sphereGeometry args={[0.27, 24, 16]} /><Material highlighted={organActive("liver")} color="#9e493e" /></mesh>
          <mesh position={[0.22, -0.25, 0.12]} rotation={[0, 0, -0.35]}><capsuleGeometry args={[0.07, 0.38, 8, 16]} /><Material highlighted={organActive("stomach")} color="#d28a78" /></mesh>
          <mesh position={[0.02, -0.38, 0.16]} rotation={[0, 0, 0.08]}><capsuleGeometry args={[0.05, 0.4, 8, 16]} /><Material highlighted={organActive("pancreas")} color="#d9a044" /></mesh>
          <mesh position={[-0.2, -0.35, 0.13]} scale={[0.62, 1, 0.45]}><sphereGeometry args={[0.1, 20, 16]} /><Material highlighted={organActive("kidneys")} color="#a9575e" /></mesh>
          <mesh position={[0.2, -0.35, 0.13]} scale={[0.62, 1, 0.45]}><sphereGeometry args={[0.1, 20, 16]} /><Material highlighted={organActive("kidneys")} color="#a9575e" /></mesh>
          <mesh position={[0, -0.6, 0.17]} scale={[0.65, 0.8, 0.55]}><torusGeometry args={[0.13, 0.045, 8, 24]} /><Material highlighted={organActive("urinary")} color="#cf9e54" /></mesh>
          <mesh position={[0, -0.58, 0.18]} scale={[0.9, 0.58, 0.7]}><sphereGeometry args={[0.2, 24, 16]} /><Material highlighted={organActive("urinary")} color="#d69c63" opacity={0.8} /></mesh>
        </group>

        <group position={[0, 1.45, 0.32]}>
          {[0.18, 0.02, -0.14, -0.3, -0.46].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.34 - Math.abs(y) * 0.12, 0.018, 8, 24, Math.PI]} /><meshStandardMaterial color={BONE} transparent opacity={0.48} /></mesh>)}
          <mesh position={[0, -0.52, 0]}><capsuleGeometry args={[0.035, 1.15, 6, 12]} /><meshStandardMaterial color={BONE} transparent opacity={0.5} /></mesh>
          <mesh position={[0, -0.72, 0]} scale={[1.15, 0.45, 0.55]}><torusGeometry args={[0.22, 0.035, 8, 24]} /><meshStandardMaterial color={BONE} transparent opacity={0.52} /></mesh>
        </group>

        {organActive("brain") && <Pulse position={[0, 2.35, 0.4]} color="#ef8fa6" />}
        {organActive("thyroid") && <><mesh position={[-0.08, 1.88, 0.34]} scale={[0.8, 1.1, 0.6]}><sphereGeometry args={[0.08, 20, 16]} /><Material highlighted color="#e76f93" /></mesh><mesh position={[0.08, 1.88, 0.34]} scale={[0.8, 1.1, 0.6]}><sphereGeometry args={[0.08, 20, 16]} /><Material highlighted color="#e76f93" /></mesh></>}
        {bloodActive && <Pulse position={[0, 1.53, 0.52]} color="#d94b52" scale={0.7} />}
        {marrowActive && <>{[[-0.23,0.25,0.1],[0.23,0.25,0.1],[-0.66,1.3,0.1],[0.66,1.3,0.1]].map((position, index) => <Pulse key={index} position={position as [number, number, number]} color="#9f58a8" scale={0.5} />)}</>}
      </group>
    </Float>
  );
}

export function AnatomicalBody({ anatomy }: { anatomy: ResultAnatomy }) {
  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden border-y border-[var(--line)] bg-[radial-gradient(circle_at_center,#d7ebe8_0%,#edf5f2_52%,var(--background)_100%)]">
      <div className="relative h-[500px]">
      <Canvas style={{ width: "100%", height: "100%", display: "block" }} camera={{ position: [0, 1.15, 6.6], fov: 31 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
        <ambientLight intensity={1.35} />
        <directionalLight position={[3, 5, 4]} intensity={2.8} color="#fff8f4" />
        <directionalLight position={[-3, 2, 2]} intensity={1.5} color="#75bcb5" />
        <pointLight position={[0, 1.6, 2.2]} intensity={1.3} color="#f7c2a9" />
        <HumanFigure anatomy={anatomy} />
        <Environment preset="studio" />
        <OrbitControls target={[0, 1.15, 0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.8} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
      <span className="pointer-events-none absolute left-3 top-3 border border-[var(--line)] bg-white/85 px-2 py-1 text-[10px] font-bold uppercase text-[var(--muted)] backdrop-blur">Drag to rotate</span>
      </div>
      <div className="border-t border-[var(--line)] bg-white/75 px-4 py-4 text-center backdrop-blur-sm">
        <p className="text-sm font-bold text-[var(--ink)]">{anatomy.label}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">{anatomy.explanation}</p>
      </div>
    </div>
  );
}