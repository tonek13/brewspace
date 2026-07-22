"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SeatDto } from "@brewspace/contracts";
import { api, ApiError } from "@/lib/api-client";
import { Spinner, ErrorNote, EmptyState } from "@/components/ui";
import { titleCase } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";
import type { SeatAvailabilityState } from "@/lib/api-client";

const FloorMap3D = dynamic(() => import("./FloorMap3D").then((m) => m.FloorMap3D), { ssr: false });

// The editor works in the X/Z plane. We map world coordinates to an SVG viewport.
const VIEW = 520;
const WORLD_HALF = 12; // world spans -12..12 on each axis
const toView = (world: number) => ((world + WORLD_HALF) / (WORLD_HALF * 2)) * VIEW;
const toWorld = (view: number) => (view / VIEW) * (WORLD_HALF * 2) - WORLD_HALF;

export function FloorMapEditor({ branchId }: { branchId: string }) {
  const { user, loading } = useSession();
  const [seats, setSeats] = useState<SeatDto[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    api
      .getFloorMap(branchId)
      .then((data) => setSeats(data.seats))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the floor map."));
  }, [branchId]);

  const previewAvailability = useMemo(() => {
    const map = new Map<string, SeatAvailabilityState>();
    seats.forEach((s) => map.set(s.id, "AVAILABLE"));
    return map;
  }, [seats]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const vx = ((event.clientX - rect.left) / rect.width) * VIEW;
      const vz = ((event.clientY - rect.top) / rect.height) * VIEW;
      const x = Math.round(Math.max(-WORLD_HALF, Math.min(WORLD_HALF, toWorld(vx))) * 2) / 2;
      const z = Math.round(Math.max(-WORLD_HALF, Math.min(WORLD_HALF, toWorld(vz))) * 2) / 2;
      setSeats((prev) => prev.map((s) => (s.id === dragging ? { ...s, positionX: x, positionZ: z } : s)));
      setDirty(true);
      setSaved(false);
    },
    [dragging],
  );

  async function save() {
    setError(null);
    try {
      await api.updateFloorMap(
        branchId,
        seats.map((s) => ({
          seatId: s.id,
          positionX: s.positionX,
          positionY: s.positionY,
          positionZ: s.positionZ,
          rotationX: s.rotationX,
          rotationY: s.rotationY,
          rotationZ: s.rotationZ,
          scaleX: s.scaleX,
          scaleY: s.scaleY,
          scaleZ: s.scaleZ,
        })),
      );
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the layout.");
    }
  }

  if (loading) return <Spinner />;
  if (!user || user.role !== "ADMIN")
    return <EmptyState title="Admins only" hint="You need an admin account to edit the floor map." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Layout</p>
          <h1 className="font-display text-4xl text-ink">Floor map editor</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-sage">Saved</span>}
          <button onClick={save} className="btn btn-primary" disabled={!dirty}>
            {dirty ? "Save layout" : "No changes"}
          </button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-steam">Drag seats to reposition them on the plan. Positions snap to a half-metre grid.</p>
          <div className="card overflow-hidden p-3">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="h-auto w-full touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
            >
              <rect x={0} y={0} width={VIEW} height={VIEW} fill="#F6EFE3" />
              {Array.from({ length: 25 }).map((_, i) => {
                const p = (i / 24) * VIEW;
                return (
                  <g key={i} stroke="#E6DED2" strokeWidth={1}>
                    <line x1={p} y1={0} x2={p} y2={VIEW} />
                    <line x1={0} y1={p} x2={VIEW} y2={p} />
                  </g>
                );
              })}
              {seats.map((seat) => {
                const cx = toView(seat.positionX);
                const cy = toView(seat.positionZ);
                const active = dragging === seat.id;
                return (
                  <g
                    key={seat.id}
                    transform={`translate(${cx}, ${cy})`}
                    className="cursor-grab"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragging(seat.id);
                    }}
                  >
                    <rect
                      x={-16}
                      y={-16}
                      width={32}
                      height={32}
                      rx={7}
                      fill={active ? "#C8874B" : "#5F7F5C"}
                      stroke="#1B1712"
                      strokeWidth={active ? 2 : 1}
                    />
                    <text textAnchor="middle" y={4} fontSize={9} fill="#FBF7F0" fontWeight={600}>
                      {seat.name.replace(/[^0-9]/g, "") || seat.name.slice(0, 3)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-steam">Live 3D preview</p>
          <FloorMap3D seats={seats} availability={previewAvailability} view="isometric" />
          <div className="card p-4">
            <h2 className="mb-2 font-display text-lg text-ink">Seats</h2>
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {seats.map((seat) => (
                <li key={seat.id} className="flex justify-between text-steam">
                  <span className="text-ink">{seat.name}</span>
                  <span>{titleCase(seat.type)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
