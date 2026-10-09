"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";

function Cabinets({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-1.2, 0.45, 0]}>
        <boxGeometry args={[2.2, 0.9, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.7, 0.45, -0.7]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.8, 0.9, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-1.2, 0.92, 0]}>
        <boxGeometry args={[2.25, 0.06, 0.65]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
    </group>
  );
}

export default function KitchenScene({ color = "#f5f5f4" }: { color?: string }) {
  return (
    <div className="h-[70vh] w-full rounded-xl overflow-hidden bg-neutral-900">
      <Canvas camera={{ position: [3, 2.2, 3.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 3]} intensity={1.1} />
        <Cabinets color={color} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#e7e5e4" />
        </mesh>
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
        <Environment preset="apartment" />
      </Canvas>
    </div>
  );
}