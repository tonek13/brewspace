"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Environment,
  Lightformer,
  ContactShadows,
  SoftShadows,
  Float,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import type { SeatDto, SeatType } from "@brewspace/contracts";
import type { SeatAvailabilityState } from "@/lib/api-client";
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

/* ------------------------------------------------------------------ */
/*  Shared materials — created once and reused across every mesh so a  */
/*  crowded room stays cheap to draw.                                  */
/* ------------------------------------------------------------------ */

type Materials = ReturnType<typeof buildMaterials>;

function buildMaterials() {
  return {
    oak: new THREE.MeshStandardMaterial({ color: "#a9793f", roughness: 0.6, metalness: 0.04 }),
    walnut: new THREE.MeshStandardMaterial({ color: "#6f4a2c", roughness: 0.5, metalness: 0.05 }),
    tabletop: new THREE.MeshStandardMaterial({ color: "#c79a5f", roughness: 0.45, metalness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ color: "#3a3733", roughness: 0.35, metalness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: "#c9ccce", roughness: 0.2, metalness: 0.95 }),
    fabricSage: new THREE.MeshStandardMaterial({ color: "#6f8f6b", roughness: 0.9 }),
    fabricClay: new THREE.MeshStandardMaterial({ color: "#b57f63", roughness: 0.92 }),
    fabricGrey: new THREE.MeshStandardMaterial({ color: "#8d867a", roughness: 0.92 }),
    cushion: new THREE.MeshStandardMaterial({ color: "#e7ddca", roughness: 0.95 }),
    plaster: new THREE.MeshStandardMaterial({ color: "#ece2d1", roughness: 1 }),
    counter: new THREE.MeshStandardMaterial({ color: "#5d3f27", roughness: 0.45, metalness: 0.06 }),
    stone: new THREE.MeshStandardMaterial({ color: "#2c2a28", roughness: 0.3, metalness: 0.2 }),
    ceramic: new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.35 }),
    pot: new THREE.MeshStandardMaterial({ color: "#b9704a", roughness: 0.8 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#4f7c46", roughness: 0.8 }),
    leafDark: new THREE.MeshStandardMaterial({ color: "#3c6338", roughness: 0.8 }),
    screen: new THREE.MeshStandardMaterial({
      color: "#0e1a24",
      emissive: new THREE.Color("#6ea8d8"),
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
    lampShade: new THREE.MeshStandardMaterial({
      color: "#26211b",
      emissive: new THREE.Color("#ffb24d"),
      emissiveIntensity: 1.4,
      roughness: 0.6,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#bfe0ef",
      emissive: new THREE.Color("#cfe8f5"),
      emissiveIntensity: 0.5,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.35,
    }),
  };
}

function fabricFor(seat: SeatDto, m: Materials): THREE.Material {
  // Deterministic-ish variety so lounge furniture isn't monotone.
  const pick = (seat.name.charCodeAt(0) + seat.name.length) % 3;
  return [m.fabricSage, m.fabricClay, m.fabricGrey][pick] ?? m.fabricSage;
}

/* ------------------------------------------------------------------ */
/*  Furniture primitives                                               */
/* ------------------------------------------------------------------ */

function Leg({ x, z, h, mat }: { x: number; z: number; h: number; mat: THREE.Material }) {
  return (
    <mesh position={[x, h / 2, z]} material={mat} castShadow>
      <boxGeometry args={[0.05, h, 0.05]} />
    </mesh>
  );
}

function Chair({ m, mat, office = false }: { m: Materials; mat: THREE.Material; office?: boolean }) {
  if (office) {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} material={m.fabricGrey} castShadow>
          <boxGeometry args={[0.46, 0.08, 0.46]} />
        </mesh>
        <mesh position={[0, 0.82, -0.2]} material={m.fabricGrey} castShadow>
          <boxGeometry args={[0.46, 0.55, 0.08]} />
        </mesh>
        <mesh position={[0, 0.28, 0]} material={m.metal}>
          <cylinderGeometry args={[0.03, 0.03, 0.44, 12]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={m.metal}>
          <cylinderGeometry args={[0.24, 0.24, 0.04, 5]} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.45, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
      </mesh>
      <mesh position={[0, 0.72, -0.19]} material={mat} castShadow>
        <boxGeometry args={[0.44, 0.5, 0.06]} />
      </mesh>
      <Leg x={-0.18} z={-0.18} h={0.45} mat={mat} />
      <Leg x={0.18} z={-0.18} h={0.45} mat={mat} />
      <Leg x={-0.18} z={0.18} h={0.45} mat={mat} />
      <Leg x={0.18} z={0.18} h={0.45} mat={mat} />
    </group>
  );
}

function CafeTable({ m }: { m: Materials }) {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} material={m.tabletop} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.05, 40]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={m.metal}>
        <cylinderGeometry args={[0.05, 0.05, 0.72, 16]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 28]} />
      </mesh>
    </group>
  );
}

function TableSet({ m, mat }: { m: Materials; mat: THREE.Material }) {
  return (
    <group>
      <CafeTable m={m} />
      <group position={[0, 0, 0.72]} rotation={[0, Math.PI, 0]}>
        <Chair m={m} mat={mat} />
      </group>
      <group position={[0, 0, -0.72]}>
        <Chair m={m} mat={mat} />
      </group>
    </group>
  );
}

function WorkDesk({ m }: { m: Materials }) {
  return (
    <group>
      {/* Desk top */}
      <mesh position={[0, 0.72, 0]} material={m.oak} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.62]} />
      </mesh>
      <Leg x={-0.55} z={-0.26} h={0.72} mat={m.metal} />
      <Leg x={0.55} z={-0.26} h={0.72} mat={m.metal} />
      <Leg x={-0.55} z={0.26} h={0.72} mat={m.metal} />
      <Leg x={0.55} z={0.26} h={0.72} mat={m.metal} />
      {/* Monitor */}
      <mesh position={[0, 1.05, -0.22]} material={m.screen}>
        <boxGeometry args={[0.62, 0.36, 0.03]} />
      </mesh>
      <mesh position={[0, 0.82, -0.22]} material={m.stone}>
        <boxGeometry args={[0.12, 0.14, 0.04]} />
      </mesh>
      <mesh position={[0, 0.75, -0.22]} material={m.stone}>
        <boxGeometry args={[0.26, 0.02, 0.14]} />
      </mesh>
      {/* Mug */}
      <mesh position={[0.4, 0.79, 0.12]} material={m.ceramic} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.09, 16]} />
      </mesh>
      {/* Chair */}
      <group position={[0, 0, 0.55]} rotation={[0, Math.PI, 0]}>
        <Chair m={m} mat={m.oak} office />
      </group>
    </group>
  );
}

function MeetingTable({ m, mat }: { m: Materials; mat: THREE.Material }) {
  const seats = [-0.7, 0, 0.7];
  return (
    <group>
      <mesh position={[0, 0.74, 0]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.07, 1.15]} />
      </mesh>
      {/* Panel legs */}
      <mesh position={[-0.9, 0.37, 0]} material={m.walnut} castShadow>
        <boxGeometry args={[0.08, 0.72, 0.9]} />
      </mesh>
      <mesh position={[0.9, 0.37, 0]} material={m.walnut} castShadow>
        <boxGeometry args={[0.08, 0.72, 0.9]} />
      </mesh>
      {/* Centerpiece */}
      <mesh position={[0, 0.82, 0]} material={m.leaf} castShadow>
        <icosahedronGeometry args={[0.12, 1]} />
      </mesh>
      {seats.map((x) => (
        <group key={`n${x}`} position={[x, 0, -0.85]}>
          <Chair m={m} mat={mat} />
        </group>
      ))}
      {seats.map((x) => (
        <group key={`s${x}`} position={[x, 0, 0.85]} rotation={[0, Math.PI, 0]}>
          <Chair m={m} mat={mat} />
        </group>
      ))}
    </group>
  );
}

function Armchair({ m, mat }: { m: Materials; mat: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.32, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.22, 0.78]} />
      </mesh>
      <mesh position={[0, 0.46, 0]} material={m.cushion} castShadow>
        <boxGeometry args={[0.7, 0.12, 0.66]} />
      </mesh>
      <mesh position={[0, 0.62, -0.34]} material={mat} castShadow>
        <boxGeometry args={[0.82, 0.5, 0.16]} />
      </mesh>
      <mesh position={[-0.4, 0.5, 0]} material={mat} castShadow>
        <boxGeometry args={[0.14, 0.34, 0.78]} />
      </mesh>
      <mesh position={[0.4, 0.5, 0]} material={mat} castShadow>
        <boxGeometry args={[0.14, 0.34, 0.78]} />
      </mesh>
      <Leg x={-0.34} z={-0.32} h={0.2} mat={m.walnut} />
      <Leg x={0.34} z={-0.32} h={0.2} mat={m.walnut} />
      <Leg x={-0.34} z={0.32} h={0.2} mat={m.walnut} />
      <Leg x={0.34} z={0.32} h={0.2} mat={m.walnut} />
    </group>
  );
}

function Sofa({ m, mat }: { m: Materials; mat: THREE.Material }) {
  const cushions = [-0.58, 0, 0.58];
  return (
    <group>
      <mesh position={[0, 0.3, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.28, 0.82]} />
      </mesh>
      <mesh position={[0, 0.62, -0.34]} material={mat} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.16]} />
      </mesh>
      <mesh position={[-0.88, 0.48, 0]} material={mat} castShadow>
        <boxGeometry args={[0.16, 0.4, 0.82]} />
      </mesh>
      <mesh position={[0.88, 0.48, 0]} material={mat} castShadow>
        <boxGeometry args={[0.16, 0.4, 0.82]} />
      </mesh>
      {cushions.map((x) => (
        <mesh key={x} position={[x, 0.5, 0.03]} material={m.cushion} castShadow>
          <boxGeometry args={[0.54, 0.14, 0.7]} />
        </mesh>
      ))}
      <Leg x={-0.8} z={-0.34} h={0.16} mat={m.walnut} />
      <Leg x={0.8} z={-0.34} h={0.16} mat={m.walnut} />
      <Leg x={-0.8} z={0.34} h={0.16} mat={m.walnut} />
      <Leg x={0.8} z={0.34} h={0.16} mat={m.walnut} />
    </group>
  );
}

function Furniture({ seat, m }: { seat: SeatDto; m: Materials }) {
  const fabric = fabricFor(seat, m);
  switch (seat.type as SeatType) {
    case "WORK_DESK":
      return <WorkDesk m={m} />;
    case "MEETING_TABLE":
      return <MeetingTable m={m} mat={m.oak} />;
    case "LOUNGE_SEAT":
      return <Armchair m={m} mat={fabric} />;
    case "SOFA":
      return <Sofa m={m} mat={fabric} />;
    case "TABLE":
    default:
      return <TableSet m={m} mat={m.oak} />;
  }
}

function footprintRadius(seat: SeatDto): number {
  switch (seat.type as SeatType) {
    case "MEETING_TABLE":
      return 1.7;
    case "SOFA":
      return 1.3;
    case "WORK_DESK":
      return 1.0;
    case "LOUNGE_SEAT":
      return 0.9;
    case "TABLE":
    default:
      return 1.0;
  }
}

/* ------------------------------------------------------------------ */
/*  A seat = furniture + a glowing availability halo on the floor      */
/* ------------------------------------------------------------------ */

function StateHalo({
  radius,
  color,
  selected,
}: {
  radius: number;
  color: string;
  selected: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const three = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!pulseRef.current) return;
    if (selected) {
      const t = (Math.sin(state.clock.elapsedTime * 3) + 1) / 2; // 0..1
      const s = 1 + t * 0.35;
      pulseRef.current.scale.set(s, s, s);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
      pulseRef.current.visible = true;
    } else {
      pulseRef.current.visible = false;
    }
  });

  return (
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Solid ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius * 0.82, radius, 56]} />
        <meshBasicMaterial
          color={three}
          transparent
          opacity={selected ? 0.95 : 0.55}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Soft fill */}
      <mesh position={[0, 0, -0.001]}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={three} transparent opacity={selected ? 0.16 : 0.07} toneMapped={false} />
      </mesh>
      {/* Pulse ring (selected only) */}
      <mesh ref={pulseRef} visible={false}>
        <ringGeometry args={[radius, radius * 1.08, 56]} />
        <meshBasicMaterial color={three} transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Seat({
  seat,
  state,
  selected,
  onSelect,
  materials,
}: {
  seat: SeatDto;
  state: SeatAvailabilityState;
  selected: boolean;
  onSelect?: (seat: SeatDto) => void;
  materials: Materials;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = SEAT_STATE_COLORS[state];
  const interactive = state === "AVAILABLE" && !!onSelect;
  const radius = footprintRadius(seat);

  useEffect(() => {
    if (!interactive) return;
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, interactive]);

  // Gentle lift + settle when hovered or selected.
  useFrame(() => {
    if (!groupRef.current) return;
    const target = selected ? 0.14 : hovered && interactive ? 0.06 : 0;
    groupRef.current.position.y += (target - groupRef.current.position.y) * 0.15;
  });

  return (
    <group
      position={[seat.positionX, 0, seat.positionZ]}
      rotation={[seat.rotationX, seat.rotationY, seat.rotationZ]}
      scale={[seat.scaleX, seat.scaleY, seat.scaleZ]}
    >
      <StateHalo radius={radius} color={color} selected={selected} />

      <group
        ref={groupRef}
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
        <Furniture seat={seat} m={materials} />
      </group>

      {(selected || hovered) && (
        <Html center distanceFactor={11} position={[0, 1.7, 0]} zIndexRange={[20, 0]}>
          <div className="pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper shadow-lift">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {seat.name} · {SEAT_STATE_LABEL[state]}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Room, props & atmosphere                                           */
/* ------------------------------------------------------------------ */

function usePlankTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#d8c199";
    ctx.fillRect(0, 0, 512, 512);
    const plankH = 64;
    for (let row = 0; row < 512 / plankH; row++) {
      const y = row * plankH;
      const shade = 205 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${shade - 8}, ${Math.floor((shade - 30) * 0.82)}, ${Math.floor((shade - 70) * 0.7)})`;
      ctx.fillRect(0, y + 1, 512, plankH - 2);
      // subtle grain streaks
      for (let g = 0; g < 22; g++) {
        ctx.strokeStyle = `rgba(120, 82, 45, ${0.04 + Math.random() * 0.06})`;
        ctx.beginPath();
        const gy = y + Math.random() * plankH;
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(170, gy + (Math.random() - 0.5) * 6, 340, gy + (Math.random() - 0.5) * 6, 512, gy);
        ctx.stroke();
      }
      // plank seam
      ctx.fillStyle = "rgba(70, 46, 24, 0.35)";
      ctx.fillRect(0, y, 512, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function Plant({ m }: { m: Materials }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={m.pot} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.4, 20]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={m.leafDark}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 20]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} material={m.leaf} castShadow>
        <icosahedronGeometry args={[0.34, 1]} />
      </mesh>
      <mesh position={[0.18, 0.95, 0.05]} material={m.leafDark} castShadow>
        <icosahedronGeometry args={[0.22, 1]} />
      </mesh>
      <mesh position={[-0.16, 0.9, -0.05]} material={m.leaf} castShadow>
        <icosahedronGeometry args={[0.24, 1]} />
      </mesh>
    </group>
  );
}

function PendantLamp({ m, y }: { m: Materials; y: number }) {
  return (
    <group>
      <mesh position={[0, y - 0.001, 0]} material={m.metal}>
        <cylinderGeometry args={[0.006, 0.006, 2.4, 6]} />
      </mesh>
      <Float speed={2} rotationIntensity={0} floatIntensity={0.25}>
        <mesh position={[0, y - 1.2, 0]} material={m.lampShade} castShadow>
          <coneGeometry args={[0.22, 0.28, 24, 1, true]} />
        </mesh>
        <mesh position={[0, y - 1.26, 0]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color="#ffcf87" toneMapped={false} />
        </mesh>
        <pointLight position={[0, y - 1.28, 0]} intensity={6} distance={5} decay={2} color="#ffc689" />
      </Float>
    </group>
  );
}

function EspressoCounter({ m, x, z }: { m: Materials; x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Base cabinet */}
      <mesh position={[0, 0.5, 0]} material={m.counter} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.0, 0.9]} />
      </mesh>
      {/* Stone top */}
      <mesh position={[0, 1.03, 0]} material={m.stone} castShadow>
        <boxGeometry args={[3.5, 0.08, 1.0]} />
      </mesh>
      {/* Espresso machine */}
      <group position={[-0.8, 1.07, 0]}>
        <mesh position={[0, 0.2, 0]} material={m.steel} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.5]} />
        </mesh>
        <mesh position={[0, 0.44, 0]} material={m.stone}>
          <boxGeometry args={[0.72, 0.08, 0.52]} />
        </mesh>
        <mesh position={[-0.18, 0.14, 0.26]} material={m.metal}>
          <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
        </mesh>
        <mesh position={[0.18, 0.14, 0.26]} material={m.metal}>
          <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
        </mesh>
      </group>
      {/* Grinder */}
      <mesh position={[0.2, 1.28, 0]} material={m.stone} castShadow>
        <boxGeometry args={[0.24, 0.42, 0.3]} />
      </mesh>
      {/* Cups on the counter */}
      {[-0.1, 0.15, 0.4].map((cx, i) => (
        <mesh key={i} position={[1.0 + cx * 0.3, 1.13, 0.28]} material={m.ceramic} castShadow>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 14]} />
        </mesh>
      ))}
      {/* Back shelf */}
      <mesh position={[0, 1.9, -0.42]} material={m.walnut} castShadow>
        <boxGeometry args={[3.2, 0.06, 0.24]} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-1.3 + i * 0.43, 1.99, -0.42]} material={m.ceramic} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.11, 14]} />
        </mesh>
      ))}
    </group>
  );
}

function Window({ m, width = 1.6 }: { m: Materials; width?: number }) {
  return (
    <group>
      {/* Frame */}
      <mesh material={m.walnut}>
        <boxGeometry args={[width + 0.16, 1.56, 0.14]} />
      </mesh>
      {/* Glass */}
      <mesh position={[0, 0, 0.02]} material={m.glass}>
        <boxGeometry args={[width, 1.4, 0.04]} />
      </mesh>
      {/* Mullions */}
      <mesh position={[0, 0, 0.06]} material={m.walnut}>
        <boxGeometry args={[0.05, 1.4, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.06]} material={m.walnut}>
        <boxGeometry args={[width, 0.05, 0.06]} />
      </mesh>
    </group>
  );
}

function Room({ seats, materials }: { seats: SeatDto[]; materials: Materials }) {
  const plank = usePlankTexture();
  const bounds = useMemo(() => {
    if (seats.length === 0) return { minX: -8, maxX: 8, minZ: -8, maxZ: 8 };
    const xs = seats.map((s) => s.positionX);
    const zs = seats.map((s) => s.positionZ);
    return {
      minX: Math.min(...xs) - 3.5,
      maxX: Math.max(...xs) + 3.5,
      minZ: Math.min(...zs) - 3.5,
      maxZ: Math.max(...zs) + 3.5,
    };
  }, [seats]);

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const wallH = 3.0;

  const floorMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.02, color: "#e8d4ac" });
    if (plank) mat.map = plank;
    return mat;
  }, [plank]);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow material={floorMat}>
        <planeGeometry args={[width, depth]} />
      </mesh>

      {/* Back wall + windows */}
      <mesh position={[cx, wallH / 2, bounds.minZ]} material={materials.plaster} receiveShadow>
        <boxGeometry args={[width, wallH, 0.16]} />
      </mesh>
      <group position={[0, 1.5, bounds.minZ + 0.09]}>
        <group position={[cx - width * 0.22, 0, 0]}>
          <Window m={materials} width={1.7} />
        </group>
        <group position={[cx + width * 0.22, 0, 0]}>
          <Window m={materials} width={1.7} />
        </group>
      </group>

      {/* Side wall */}
      <mesh position={[bounds.minX, wallH / 2, cz]} material={materials.plaster} receiveShadow>
        <boxGeometry args={[0.16, wallH, depth]} />
      </mesh>
      {/* Baseboards */}
      <mesh position={[cx, 0.08, bounds.minZ + 0.12]} material={materials.walnut}>
        <boxGeometry args={[width, 0.16, 0.05]} />
      </mesh>
      <mesh position={[bounds.minX + 0.12, 0.08, cz]} material={materials.walnut}>
        <boxGeometry args={[0.05, 0.16, depth]} />
      </mesh>

      {/* Espresso counter along the back */}
      <EspressoCounter m={materials} x={bounds.maxX - 2.4} z={bounds.minZ + 0.9} />

      {/* Plants in the corners */}
      <group position={[bounds.minX + 0.7, 0, bounds.maxZ - 0.7]}>
        <Plant m={materials} />
      </group>
      <group position={[bounds.maxX - 0.7, 0, bounds.maxZ - 0.7]}>
        <Plant m={materials} />
      </group>
      <group position={[bounds.minX + 0.7, 0, bounds.minZ + 0.9]}>
        <Plant m={materials} />
      </group>

      {/* Area rug under the center of the room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, cz]} receiveShadow>
        <planeGeometry args={[Math.min(width * 0.5, 6), Math.min(depth * 0.5, 6)]} />
        <meshStandardMaterial color="#c58a5f" roughness={1} />
      </mesh>

      {/* Ceiling pendant lamps */}
      <PendantLamp m={materials} y={wallH} />
      <group position={[cx - width * 0.2, 0, cz]}>
        <PendantLamp m={materials} y={wallH} />
      </group>
      <group position={[cx + width * 0.2, 0, cz]}>
        <PendantLamp m={materials} y={wallH} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera + lighting rig                                              */
/* ------------------------------------------------------------------ */

function CameraRig({
  view,
  controlsRef,
}: {
  view: CameraView;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(15, 13, 15));
  const animating = useRef(true);

  useEffect(() => {
    if (view === "top") target.current.set(0.001, 26, 0.001);
    else target.current.set(15, 13, 15);
    animating.current = true;
  }, [view]);

  useFrame(() => {
    if (!animating.current) return;
    camera.position.lerp(target.current, 0.08);
    const c = controlsRef.current;
    if (c) {
      c.target.lerp(new THREE.Vector3(0, 0.6, 0), 0.08);
      c.update();
    } else {
      camera.lookAt(0, 0.6, 0);
    }
    if (camera.position.distanceTo(target.current) < 0.1) animating.current = false;
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

export function FloorMap3D({
  seats,
  availability,
  selectedSeatId,
  onSelectSeat,
  view = "isometric",
}: FloorMap3DProps) {
  const controlsRef = useRef<any>(null);
  const materials = useMemo(() => buildMaterials(), []);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-card border border-line bg-[#efe6d6]">
      <Canvas
        shadows
        camera={{ position: [15, 13, 15], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#efe6d6"]} />
        <fog attach="fog" args={["#e7dcc9", 34, 62]} />

        <SoftShadows size={26} samples={12} focus={0.75} />
        <CameraRig view={view} controlsRef={controlsRef} />

        {/* Lighting */}
        <ambientLight intensity={0.45} />
        <hemisphereLight args={["#fff4e0", "#8a765c", 0.6]} />
        <directionalLight
          position={[12, 18, 6]}
          intensity={2.1}
          color="#ffedd2"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-10, 8, -8]} intensity={0.35} color="#cfe0ff" />

        <Room seats={seats} materials={materials} />

        {seats.map((seat) => (
          <Seat
            key={seat.id}
            seat={seat}
            state={availability?.get(seat.id) ?? "UNAVAILABLE"}
            selected={selectedSeatId === seat.id}
            onSelect={onSelectSeat}
            materials={materials}
          />
        ))}

        {/* Grounding shadow under everything for contact darkening */}
        <ContactShadows
          position={[0, 0.015, 0]}
          scale={60}
          resolution={1024}
          far={6}
          blur={2.6}
          opacity={0.42}
          color="#3a2a1a"
        />

        {/* Subtle environment reflections built from lightformers (no downloads) */}
        <Environment resolution={128}>
          <Lightformer intensity={1.2} position={[0, 6, 0]} scale={[10, 10, 1]} color="#fff2dc" />
          <Lightformer intensity={0.6} position={[8, 3, 6]} scale={[4, 6, 1]} color="#ffe0b8" />
          <Lightformer intensity={0.5} position={[-8, 3, -4]} scale={[4, 6, 1]} color="#cfe0ff" />
        </Environment>

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={7}
          maxDistance={38}
          target={[0, 0.6, 0]}
        />

        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.7}
          />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
          <SMAA />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
