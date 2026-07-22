"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { SeatDto } from "@brewspace/contracts";
import type { SeatAvailability, SeatAvailabilityState } from "@/lib/api-client";
import { SEAT_STATE_COLORS, SEAT_STATE_LABEL } from "@/lib/format";

export type CameraView = "isometric" | "top";

interface FloorMap3DProps {
  seats: SeatDto[];
  availability?: Map<string, SeatAvailabilityState>;
  selectedSeatId?: string | null;
  onSelectSeat?: (seat: SeatDto) => void;
  view?: CameraView;
  editable?: boolean;
  onMoveSeat?: (seatId: string, position: { x: number; z: number }) => void;
}

function seatFootprint(seat: SeatDto): [number, number, number] {
  switch (seat.type) {
    case "WORK_DESK":
      return [1.1, 0.72, 0.6];
    case "MEETING_TABLE":
      return [2.2, 0.74, 1.2];
    case "LOUNGE_SEAT":
      return [0.9, 0.5, 0.9];
    case "SOFA":
      return [1.8, 0.6, 0.8];
    case "TABLE":
    default:
      return [1.0, 0.74, 1.0];
  }
}

function SeatMesh({
  seat,
  state,
  selected,
  onSelect,
}: {
  seat: SeatDto;
  state: SeatAvailabilityState;
  selected: boolean;
  onSelect?: (seat: SeatDto) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [w, h, d] = seatFootprint(seat);
  const color = SEAT_STATE_COLORS[state];
  const interactive = state === "AVAILABLE" && !!onSelect;

  useEffect(() => {
    document.body.style.cursor = hovered && interactive ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, interactive]);

  return (
    <group
      position={[seat.positionX, h / 2, seat.positionZ]}
      rotation={[seat.rotationX, seat.rotationY, seat.rotationZ]}
      scale={[seat.scaleX, seat.scaleY, seat.scaleZ]}
      onClick={(event) => {
        event.stopPropagation();
        if (interactive) onSelect?.(seat);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[w, h, d]} radius={0.06} smoothness={3}>
        <meshStandardMaterial
          color={color}
          roughness={0.65}
          metalness={0.05}
          emissive={selected ? new THREE.Color(color) : new THREE.Color("#000000")}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </RoundedBox>

      {(selected || hovered) && (
        <Html center distanceFactor={9} position={[0, h / 2 + 0.5, 0]} zIndexRange={[20, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper shadow-lift">
            {seat.name} · {SEAT_STATE_LABEL[state]}
          </div>
        </Html>
      )}
    </group>
  );
}

function Room({ seats }: { seats: SeatDto[] }) {
  // Size the room to the seat bounds with a margin so any floor plan fits.
  const bounds = useMemo(() => {
    if (seats.length === 0) return { minX: -8, maxX: 8, minZ: -8, maxZ: 8 };
    const xs = seats.map((s) => s.positionX);
    const zs = seats.map((s) => s.positionZ);
    return {
      minX: Math.min(...xs) - 3,
      maxX: Math.max(...xs) + 3,
      minZ: Math.min(...zs) - 3,
      maxZ: Math.max(...zs) + 3,
    };
  }, [seats]);

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#F1E9DC" roughness={0.9} />
      </mesh>
      {/* Grid overlay */}
      <gridHelper
        args={[Math.max(width, depth), Math.max(width, depth), "#E0D5C4", "#EDE5D8"]}
        position={[cx, 0.01, cz]}
      />
      {/* Back wall */}
      <mesh position={[cx, 1.4, bounds.minZ]}>
        <boxGeometry args={[width, 2.8, 0.12]} />
        <meshStandardMaterial color="#EAE0D1" roughness={1} />
      </mesh>
      {/* Side wall */}
      <mesh position={[bounds.minX, 1.4, cz]}>
        <boxGeometry args={[0.12, 2.8, depth]} />
        <meshStandardMaterial color="#EAE0D1" roughness={1} />
      </mesh>
      {/* Service counter along the back-right */}
      <mesh position={[bounds.maxX - 2, 0.55, bounds.minZ + 1.2]}>
        <boxGeometry args={[3.2, 1.1, 0.9]} />
        <meshStandardMaterial color="#6B4A2E" roughness={0.5} />
      </mesh>
    </group>
  );
}

function CameraRig({ view }: { view: CameraView }) {
  const { camera } = useThree();
  useEffect(() => {
    if (view === "top") {
      camera.position.set(0, 22, 0.001);
    } else {
      camera.position.set(14, 13, 14);
    }
    camera.lookAt(0, 0, 0);
  }, [view, camera]);
  return null;
}

export function FloorMap3D({
  seats,
  availability,
  selectedSeatId,
  onSelectSeat,
  view = "isometric",
}: FloorMap3DProps) {
  const controlsRef = useRef(null);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-card border border-line bg-[#F6EFE3]">
      <Canvas shadows camera={{ position: [14, 13, 14], fov: 42 }} dpr={[1, 2]}>
        <CameraRig view={view} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 16, 8]} intensity={1.1} castShadow />
        <directionalLight position={[-8, 10, -6]} intensity={0.3} />
        <Room seats={seats} />
        {seats.map((seat) => (
          <SeatMesh
            key={seat.id}
            seat={seat}
            state={availability?.get(seat.id) ?? "UNAVAILABLE"}
            selected={selectedSeatId === seat.id}
            onSelect={onSelectSeat}
          />
        ))}
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableDamping
          maxPolarAngle={Math.PI / 2.05}
          minDistance={6}
          maxDistance={30}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
