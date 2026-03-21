import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Text, Line } from '@react-three/drei';
import * as THREE from 'three';

const Node = ({ position, name, load, type }: { position: [number, number, number], name: string, load: number, type: string }) => {
  const mesh = useRef<THREE.Mesh>(null);
  
  const color = useMemo(() => {
    if (load > 80) return '#ef4444';
    if (load > 50) return '#f59e0b';
    return '#10b981';
  }, [load]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.2;
      mesh.current.rotation.y = Math.cos(state.clock.getElapsedTime() * 0.5) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group position={position}>
        <Sphere ref={mesh} args={[0.5, 32, 32]}>
          <MeshDistortMaterial 
            color={color} 
            speed={2} 
            distort={0.3} 
            radius={1}
            emissive={color}
            emissiveIntensity={0.5}
          />
        </Sphere>
        <Text
          position={[0, -0.8, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
        <Text
          position={[0, -1.1, 0]}
          fontSize={0.15}
          color="#71717a"
          anchorX="center"
          anchorY="middle"
        >
          {type} • {load}%
        </Text>
      </group>
    </Float>
  );
};

const Connection = ({ start, end }: { start: [number, number, number], end: [number, number, number] }) => {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  
  return (
    <Line
      points={points}
      color="#ffffff10"
      lineWidth={1}
      transparent
      opacity={0.2}
    />
  );
};

export const Topology3D = () => {
  const nodes = [
    { id: '1', name: 'API-Gateway', pos: [0, 2, 0] as [number, number, number], load: 45, type: 'Load Balancer' },
    { id: '2', name: 'Auth-Service', pos: [-3, 0, 0] as [number, number, number], load: 82, type: 'Microservice' },
    { id: '3', name: 'Payment-Worker', pos: [3, 0, 0] as [number, number, number], load: 12, type: 'Worker' },
    { id: '4', name: 'Redis-Cache', pos: [0, -2, 0] as [number, number, number], load: 25, type: 'Database' },
    { id: '5', name: 'Postgres-DB', pos: [0, -4, 0] as [number, number, number], load: 65, type: 'Database' },
  ];

  return (
    <div className="w-full h-[600px] bg-zinc-950 rounded-2xl border border-white/5 overflow-hidden relative">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-lg font-medium text-white">Infrastructure Topology</h3>
        <p className="text-sm text-zinc-500">Real-time node health and connectivity</p>
      </div>
      
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <color attach="background" args={['#09090b']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <group>
          {nodes.map(node => (
            <Node key={node.id} position={node.pos} name={node.name} load={node.load} type={node.type} />
          ))}
          
          <Connection start={nodes[0].pos} end={nodes[1].pos} />
          <Connection start={nodes[0].pos} end={nodes[2].pos} />
          <Connection start={nodes[1].pos} end={nodes[3].pos} />
          <Connection start={nodes[2].pos} end={nodes[3].pos} />
          <Connection start={nodes[3].pos} end={nodes[4].pos} />
        </group>
        
        <OrbitControls enablePan={false} maxDistance={15} minDistance={5} />
      </Canvas>
    </div>
  );
};
