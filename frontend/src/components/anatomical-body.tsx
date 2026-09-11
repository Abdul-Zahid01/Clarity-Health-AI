"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

import type { BodyRegion, ResultAnatomy } from "@/lib/result-anatomy";

const HIGHLIGHT = "#f2b84b";
const BODY = "#d7e4df";

function active(regions: BodyRegion[], region: BodyRegion) {
  return regions.includes(region);
}

function Material({ highlighted, color = HIGHLIGHT, opacity = 1 }: { highlighted: boolean; color?: string; opacity?: number }) {
  return <meshPhysicalMaterial color={highlighted ? color : BODY} emissive={highlighted ? color : "#000000"} emissiveIntensity={highlighted ? 1.4 : 0} roughness={0.5} metalness={0.05} transparent opacity={highlighted ? opacity : 0.42} depthWrite={highlighted} />;
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

function Limb({ position, rotation = [0, 0, 0], length, highlighted }: { position: [number, number, number]; rotation?: [number, number, number]; length: number; highlighted: boolean }) {
  return <mesh position={position} rotation={rotation}><capsuleGeometry args={[0.14, length, 8, 16]} /><Material highlighted={highlighted} /></mesh>;
}

function HumanFigure({ anatomy }: { anatomy: ResultAnatomy }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.12;
  });
  const regions = anatomy.regions;
  const muscleActive = active(regions, "muscles");
  const bloodActive = active(regions, "blood");
  const marrowActive = active(regions, "bone-marrow");

  return (
    <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.12}>
      <group ref={group} position={[0, -0.12, 0]}>
        <mesh position={[0, 2.05, 0]}><sphereGeometry args={[0.36, 32, 32]} /><Material highlighted={active(regions, "brain")} color="#f0a9b8" /></mesh>
        <mesh position={[0, 1.56, 0]}><capsuleGeometry args={[0.46, 0.85, 12, 24]} /><Material highlighted={bloodActive || active(regions, "liver") || active(regions, "kidneys") || active(regions, "pancreas")} /></mesh>
        <Limb position={[-0.64, 1.37, 0]} rotation={[0, 0, -0.18]} length={0.92} highlighted={muscleActive || bloodActive || marrowActive} />
        <Limb position={[0.64, 1.37, 0]} rotation={[0, 0, 0.18]} length={0.92} highlighted={muscleActive || bloodActive || marrowActive} />
        <Limb position={[-0.23, 0.35, 0]} rotation={[0, 0, 0.04]} length={1.35} highlighted={muscleActive || bloodActive || marrowActive} />
        <Limb position={[0.23, 0.35, 0]} rotation={[0, 0, -0.04]} length={1.35} highlighted={muscleActive || bloodActive || marrowActive} />

        {active(regions, "brain") && <><mesh position={[0, 2.08, 0.14]} scale={[1, 0.7, 0.55]}><sphereGeometry args={[0.22, 24, 24]} /><Material highlighted color="#ef8fa6" /></mesh><Pulse position={[0, 2.1, 0.42]} color="#ef8fa6" /></>}
        {active(regions, "thyroid") && <><mesh position={[-0.09, 1.74, 0.38]} scale={[0.8, 1.1, 0.6]}><sphereGeometry args={[0.1, 20, 20]} /><Material highlighted color="#e76f93" /></mesh><mesh position={[0.09, 1.74, 0.38]} scale={[0.8, 1.1, 0.6]}><sphereGeometry args={[0.1, 20, 20]} /><Material highlighted color="#e76f93" /></mesh><Pulse position={[0, 1.74, 0.54]} color="#e76f93" /></>}
        {active(regions, "liver") && <><mesh position={[0.18, 1.34, 0.37]} scale={[1.5, 0.72, 0.55]} rotation={[0, 0, -0.08]}><sphereGeometry args={[0.22, 24, 24]} /><Material highlighted color="#b9513f" /></mesh><Pulse position={[0.25, 1.35, 0.58]} color="#e77b55" /></>}
        {active(regions, "pancreas") && <><mesh position={[0.02, 1.16, 0.42]} scale={[1.8, 0.45, 0.5]} rotation={[0, 0, 0.05]}><sphereGeometry args={[0.13, 24, 24]} /><Material highlighted color="#e2a752" /></mesh><Pulse position={[0, 1.15, 0.58]} /></>}
        {active(regions, "kidneys") && <><mesh position={[-0.2, 1.05, 0.32]} scale={[0.65, 1, 0.5]}><sphereGeometry args={[0.13, 24, 24]} /><Material highlighted color="#c95e62" /></mesh><mesh position={[0.2, 1.05, 0.32]} scale={[0.65, 1, 0.5]}><sphereGeometry args={[0.13, 24, 24]} /><Material highlighted color="#c95e62" /></mesh><Pulse position={[-0.2, 1.05, 0.52]} color="#df777a" /><Pulse position={[0.2, 1.05, 0.52]} color="#df777a" /></>}
        {active(regions, "urinary") && <><mesh position={[0, 0.78, 0.35]} scale={[0.8, 0.65, 0.55]}><sphereGeometry args={[0.14, 24, 24]} /><Material highlighted color="#e0ad39" /></mesh><Pulse position={[0, 0.78, 0.53]} /></>}
        {active(regions, "immune") && <>{[[-0.42, 1.63, 0.28],[0.42, 1.63, 0.28],[-0.32, 0.9, 0.24],[0.32, 0.9, 0.24]].map((position, index) => <Pulse key={index} position={position as [number, number, number]} color="#7b67c7" scale={0.7} />)}</>}
        {bloodActive && <>{[[-0.5,1.25,0.3],[0.48,1.15,0.3],[-0.23,0.28,0.25],[0.25,0.1,0.25],[0,1.48,0.42]].map((position, index) => <Pulse key={index} position={position as [number, number, number]} color="#d94b52" scale={0.55} />)}</>}
        {marrowActive && <>{[[-0.23,0.25,0.1],[0.23,0.25,0.1],[-0.66,1.3,0.1],[0.66,1.3,0.1]].map((position, index) => <Pulse key={index} position={position as [number, number, number]} color="#9f58a8" scale={0.5} />)}</>}
      </group>
    </Float>
  );
}

export function AnatomicalBody({ anatomy }: { anatomy: ResultAnatomy }) {
  return (
    <div className="relative h-[430px] min-w-0 w-full max-w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(20,125,115,0.12),transparent_68%)]">
      <Canvas style={{ width: "100%", height: "100%", display: "block" }} camera={{ position: [0, 1.05, 5.8], fov: 37 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
        <ambientLight intensity={1.7} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} color="#ffffff" />
        <directionalLight position={[-3, 2, 2]} intensity={1.2} color="#8fc8c1" />
        <HumanFigure anatomy={anatomy} />
        <Environment preset="studio" />
        <OrbitControls target={[0, 1.05, 0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.6} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/75 to-transparent px-4 pb-4 pt-12 text-center">
        <p className="text-sm font-bold text-[var(--ink)]">{anatomy.label}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">{anatomy.explanation}</p>
      </div>
      <span className="pointer-events-none absolute left-3 top-3 border border-[var(--line)] bg-white/85 px-2 py-1 text-[10px] font-bold uppercase text-[var(--muted)] backdrop-blur">Drag to rotate</span>
    </div>
  );
}