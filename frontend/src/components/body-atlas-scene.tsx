"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, type ComponentRef, type ReactNode } from "react";
import * as THREE from "three";

import { bodyRegions, type BodyRegion, type ResultAnatomy } from "@/lib/result-anatomy";

type Point = [number, number, number];
type SceneProps = {
  anatomy: ResultAnatomy;
  animate: boolean;
  rotation: number;
  resetVersion: number;
  onReady: () => void;
  onContextLost: () => void;
};

const NERVES: Point[][] = [
  [[0, 1.65, -0.12], [0, 0.65, -0.13], [0, -0.45, -0.1]],
  ...[-1, 1].flatMap((side): Point[][] => [
    [[0, 1.05, -0.12], [side * 0.36, 0.94, -0.08], [side * 0.6, 0.3, 0], [side * 0.78, -0.5, 0]],
    [[0, -0.4, -0.1], [side * 0.22, -0.8, -0.06], [side * 0.23, -1.95, 0]],
  ]),
];
const CIRCULATION: Point[][] = [
  [[0, 0.65, 0.2], [-0.08, 1, 0.18], [-0.05, 1.4, 0.1], [0, 1.85, 0.05]],
  [[0, 0.65, 0.2], [-0.3, 0.75, 0.12], [-0.58, 0.3, 0.05], [-0.77, -0.5, 0.06]],
  [[0, 0.65, 0.2], [0.3, 0.75, 0.12], [0.58, 0.3, 0.05], [0.77, -0.5, 0.06]],
  [[0, 0.65, 0.2], [0, -0.2, 0.12], [-0.22, -0.85, 0.02], [-0.22, -1.95, 0.04]],
  [[0, 0.65, 0.2], [0, -0.2, 0.12], [0.22, -0.85, 0.02], [0.22, -1.95, 0.04]],
];
const REGION_POINTS: Partial<Record<BodyRegion, Point>> = {
  thyroid: [0.1, 1.27, 0.24], pituitary: [0, 1.65, 0.22],
  heart: [0.07, 0.72, 0.32], liver: [-0.2, 0.35, 0.31],
  kidneys: [0.27, 0.12, 0.14], pancreas: [0.07, 0.05, 0.23],
};

function RenderLifecycle({ animate, onContextLost }: Pick<SceneProps, "animate" | "onContextLost">) {
  const { invalidate, gl } = useThree();
  useEffect(() => {
    // Demand rendering stays idle when paused/offscreen; animation is capped at 30 requests/s.
    if (!animate) return;
    const timer = window.setInterval(invalidate, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [animate, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    function lost(event: Event) {
      event.preventDefault();
      onContextLost();
    }
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onContextLost]);
  return null;
}

function HumanShell({ onReady }: Pick<SceneProps, "onReady">) {
  const { scene } = useGLTF("/models/bodyparts3d/human-skin.glb");
  const { model, material } = useMemo(() => {
    const model = scene.clone(true);
    const material = new THREE.MeshStandardMaterial({
      color: "#c79879", transparent: true, opacity: 0.1, roughness: 0.8,
      depthWrite: false, side: THREE.FrontSide,
    });
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const height = bounds.getSize(new THREE.Vector3()).y;
    model.position.sub(center);
    const normalized = new THREE.Group();
    normalized.add(model);
    normalized.scale.setScalar(4.4 / height);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = material;
        object.renderOrder = 2;
      }
    });
    return { model: normalized, material };
  }, [scene]);
  useEffect(() => {
    onReady();
    return () => material.dispose();
  }, [onReady, material]);
  return <primitive object={model} dispose={null} />;
}

function Organ({ position, scale, highlighted, color = bodyRegions.muscles.color, children }: {
  position: Point; scale: Point; highlighted: boolean; color?: string; children?: ReactNode;
}) {
  return (
    <mesh position={position} scale={scale}>
      {children ?? <sphereGeometry args={[1, 24, 16]} />}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={highlighted ? 0.65 : 0} transparent opacity={highlighted ? 1 : 0.48} roughness={0.6} metalness={0.02} />
    </mesh>
  );
}

function Pathway({ points, highlighted, radius = 0.012, color = bodyRegions.blood.color }: {
  points: Point[]; highlighted: boolean; radius?: number; color?: string;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), [points]);
  return <mesh><tubeGeometry args={[curve, 32, highlighted ? radius * 1.3 : radius, 6, false]} /><meshBasicMaterial color={color} transparent opacity={highlighted ? 1 : 0.23} depthWrite={false} /></mesh>;
}

function FlowParticles({ animate }: Pick<SceneProps, "animate">) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const phase = useRef(0);
  const curves = useMemo(() => CIRCULATION.map((points) => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))), []);
  const transform = useMemo(() => new THREE.Object3D(), []);
  useFrame((_state, delta) => {
    const instances = mesh.current;
    if (!instances) return;
    if (animate) phase.current += Math.min(delta, 0.05) * 0.18;
    curves.forEach((curve, pathIndex) => {
      for (let particle = 0; particle < 3; particle++) {
        curve.getPointAt((phase.current + particle / 3) % 1, transform.position);
        transform.updateMatrix();
        instances.setMatrixAt(pathIndex * 3 + particle, transform.matrix);
      }
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, curves.length * 3]} frustumCulled={false}><sphereGeometry args={[0.022, 8, 6]} /><meshBasicMaterial color="#ef7970" /></instancedMesh>;
}

function Anatomy({ anatomy, animate, rotation, onReady }: Pick<SceneProps, "anatomy" | "animate" | "rotation" | "onReady">) {
  const body = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Group>(null);
  const phase = useRef(0);
  useFrame((_state, delta) => {
    if (animate) phase.current += Math.min(delta, 0.05);
    if (body.current) body.current.scale.y = animate ? 1 + Math.sin(phase.current * 0.8) * 0.0015 : 1;
    if (heart.current) heart.current.scale.setScalar(animate && anatomy.regions.includes("heart") ? 1 + Math.sin(phase.current * Math.PI * 2) * 0.045 : 1);
  });
  const isActive = (region: BodyRegion) => anatomy.regions.includes(region);
  const kidneyShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.02, 0.2);
    shape.bezierCurveTo(-0.2, 0.25, -0.22, -0.22, 0.02, -0.2);
    shape.bezierCurveTo(0.15, -0.17, 0.02, -0.04, 0.02, 0);
    shape.bezierCurveTo(0.02, 0.05, 0.15, 0.15, 0.02, 0.2);
    return shape;
  }, []);
  return (
    <group ref={body} rotation={[0, rotation, 0]}>
      <Suspense fallback={null}><HumanShell onReady={onReady} /></Suspense>
      <Organ position={[-0.075, 1.85, 0]} scale={[0.15, 0.21, 0.16]} highlighted={isActive("brain")} color={bodyRegions.brain.color} />
      <Organ position={[0.075, 1.85, 0]} scale={[0.15, 0.21, 0.16]} highlighted={isActive("brain")} color={bodyRegions.brain.color} />
      <Organ position={[0, 1.65, 0.14]} scale={[0.035, 0.035, 0.035]} highlighted={isActive("pituitary")} color={bodyRegions.pituitary.color} />
      {anatomy.regions.map((region) => {
        const point = REGION_POINTS[region];
        return point ? <group key={region} position={point}>
          <mesh><torusGeometry args={[0.115, 0.008, 6, 32]} /><meshBasicMaterial color="#0b6058" depthTest={false} transparent opacity={0.85} /></mesh>
          <Html position={[0.17, 0, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}><span className="whitespace-nowrap rounded border border-teal-300 bg-white/95 px-1.5 py-1 text-[10px] font-bold text-teal-900">{bodyRegions[region].label}</span></Html>
        </group> : null;
      })}
      {NERVES.map((points, index) => <Pathway key={`nerve-${index}`} points={points} highlighted={isActive("nerves")} color={bodyRegions.nerves.color} radius={0.012} />)}
      <Pathway points={[[0, 1.4, -0.17], [0, 0.5, -0.17], [0, -0.45, -0.16]]} highlighted={isActive("bones")} color={bodyRegions.bones.color} radius={0.025} />
      {[-1, 1].map((side) => <group key={side}>
        <Organ position={[side * 0.065, 1.27, 0.2]} scale={[0.055, 0.085, 0.045]} highlighted={isActive("thyroid")} color={bodyRegions.thyroid.color} />
        <Organ position={[side * 0.21, 0.8, 0.02]} scale={[0.17, 0.37, 0.13]} highlighted={false} color="#d79c9e" />
        <group position={[side * 0.25, 0.12, -0.01]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
          <Organ position={[0, 0, 0]} scale={[0.7, 0.8, 0.7]} highlighted={isActive("kidneys")} color={bodyRegions.kidneys.color}><extrudeGeometry args={[kidneyShape, { depth: 0.09, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, steps: 1, curveSegments: 12 }]} /></Organ>
        </group>
        <Pathway points={[[side * 0.16, -0.5, -0.04], [side * 0.23, -1.18, 0], [side * 0.23, -1.98, 0.02]]} highlighted={isActive("bones")} color={bodyRegions.bones.color} radius={0.026} />
        <Pathway points={[[side * 0.36, 0.99, -0.03], [side * 0.58, 0.35, 0], [side * 0.76, -0.5, 0.02]]} highlighted={isActive("bones")} color={bodyRegions.bones.color} radius={0.022} />
        <Organ position={[side * 0.22, -1.07, 0.04]} scale={[0.017, 0.3, 0.017]} highlighted={isActive("bone-marrow")} color={bodyRegions["bone-marrow"].color} />
        <Organ position={[side * 0.56, 0.46, 0.03]} scale={[0.014, 0.21, 0.014]} highlighted={isActive("bone-marrow")} color={bodyRegions["bone-marrow"].color} />
        {isActive("muscles") && <>
          <Organ position={[side * 0.24, -1.08, 0.07]} scale={[0.11, 0.37, 0.08]} highlighted />
          <Organ position={[side * 0.56, 0.5, 0.05]} scale={[0.075, 0.2, 0.06]} highlighted />
        </>}
        {isActive("immune") && [0.86, 0.7, -0.58].map((y) => <Organ key={y} position={[side * (y < 0 ? 0.18 : 0.35), y, 0.14]} scale={[0.045, 0.06, 0.04]} highlighted color={bodyRegions.immune.color} />)}
        <Pathway points={[[side * 0.25, 0.03, 0.02], [side * 0.18, -0.22, 0.08], [0, -0.55, 0.15]]} highlighted={isActive("urinary")} color={bodyRegions.urinary.color} radius={0.014} />
        {[0.98, 0.83, 0.68, 0.53].map((y) => <Pathway key={y} points={[[0, y + 0.02, -0.1], [side * 0.28, y, 0.04], [side * 0.12, y - 0.08, 0.24]]} highlighted={isActive("bones")} color={bodyRegions.bones.color} radius={0.013} />)}
      </group>)}
      <Organ position={[0, 1.25, 0.2]} scale={[0.035, 0.025, 0.025]} highlighted={isActive("thyroid")} color={bodyRegions.thyroid.color} />
      <group ref={heart} position={[0.065, 0.72, 0.2]} rotation={[0, 0, -0.3]}>
        <Organ position={[0, -0.035, 0]} scale={[0.105, 0.16, 0.09]} highlighted={isActive("heart")} color={bodyRegions.heart.color} />
        <Organ position={[-0.065, 0.07, 0]} scale={[0.07, 0.065, 0.07]} highlighted={isActive("heart")} color={bodyRegions.heart.color} />
        <Pathway points={[[0, 0.07, 0], [0, 0.22, 0], [-0.08, 0.22, 0], [-0.09, 0.1, 0]]} highlighted={isActive("heart")} radius={0.025} />
      </group>
      <Organ position={[-0.19, 0.35, 0.14]} scale={[0.26, 0.13, 0.17]} highlighted={isActive("liver")} color={bodyRegions.liver.color} />
      <Organ position={[0.2, 0.27, 0.12]} scale={[0.12, 0.17, 0.11]} highlighted={isActive("stomach")} color={bodyRegions.stomach.color} />
      <Organ position={[0.07, 0.05, 0.15]} scale={[0.2, 0.045, 0.06]} highlighted={isActive("pancreas")} color={bodyRegions.pancreas.color} />
      <Organ position={[0, -0.57, 0.14]} scale={[0.11, 0.12, 0.09]} highlighted={isActive("urinary")} color={bodyRegions.urinary.color} />
      {CIRCULATION.map((points, index) => <Pathway key={index} points={points} highlighted={isActive("blood")} radius={0.009} />)}
      {isActive("blood") && <FlowParticles animate={animate} />}
    </group>
  );
}

function Controls({ resetVersion }: Pick<SceneProps, "resetVersion">) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => { controls.current?.reset(); }, [resetVersion]);
  return <OrbitControls ref={controls} target={[0, 0, 0]} enablePan={false} enableZoom={false} enableDamping={false} minPolarAngle={Math.PI / 2.8} maxPolarAngle={Math.PI / 1.65} />;
}

export function BodyAtlasScene(props: SceneProps) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      camera={{ position: [0, 0.1, 8], fov: 34 }}
      frameloop="demand"
      dpr={[1, 1.25]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      fallback={<p role="status" className="atlas-message">WebGL is not available. Read the related systems below.</p>}
    >
      <RenderLifecycle animate={props.animate} onContextLost={props.onContextLost} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#fff4e3" />
      <directionalLight position={[-3, 1, 2]} intensity={1.2} color="#d2f3ee" />
      <Anatomy anatomy={props.anatomy} animate={props.animate} rotation={props.rotation} onReady={props.onReady} />
      <Controls resetVersion={props.resetVersion} />
    </Canvas>
  );
}
