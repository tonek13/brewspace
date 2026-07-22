"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { BranchDto, SeatDto } from "@brewspace/contracts";
import { api, ApiError, type SeatAvailabilityState, type HoldDto } from "@/lib/api-client";
import { Spinner, ErrorNote, Badge, Button } from "@/components/ui";
import { SEAT_STATE_COLORS, SEAT_STATE_LABEL, titleCase } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";
import { HoldCountdown } from "./HoldCountdown";
import type { CameraView } from "@/features/floor-map/FloorMap3D";

const FloorMap3D = dynamic(
  () => import("@/features/floor-map/FloorMap3D").then((m) => m.FloorMap3D),
  { ssr: false, loading: () => <div className="flex h-[460px] items-center justify-center rounded-card border border-line bg-[#F6EFE3]"><Spinner label="Building the room…" /></div> },
);

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const DURATIONS = [60, 90, 120, 180];

export function BranchBooking({ branch }: { branch: BranchDto }) {
  const router = useRouter();
  const { user } = useSession();

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDuration] = useState(90);
  const [partySize, setPartySize] = useState(2);

  const [seats, setSeats] = useState<SeatDto[]>([]);
  const [availability, setAvailability] = useState<Map<string, SeatAvailabilityState>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CameraView>("isometric");

  const [selectedSeat, setSelectedSeat] = useState<SeatDto | null>(null);
  const [hold, setHold] = useState<HoldDto | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number>(0);
  const [working, setWorking] = useState(false);

  // Load the static floor map once.
  useEffect(() => {
    api
      .getFloorMap(branch.id)
      .then((data) => setSeats(data.seats))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the floor map."));
  }, [branch.id]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedSeat(null);
    try {
      const result = await api.getAvailability(branch.id, { date, startTime, durationMinutes, partySize });
      const map = new Map<string, SeatAvailabilityState>();
      for (const entry of result) map.set(entry.seat.id, entry.state);
      setAvailability(map);
      // Seats not returned (below capacity) are shown as unavailable.
      setSeats((current) => {
        const known = new Set(result.map((r) => r.seat.id));
        for (const seat of current) if (!known.has(seat.id)) map.set(seat.id, "UNAVAILABLE");
        return current;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not check availability.");
      setAvailability(new Map());
    } finally {
      setLoading(false);
    }
  }, [branch.id, date, startTime, durationMinutes, partySize]);

  const startAtIso = useMemo(() => new Date(`${date}T${startTime}:00`).toISOString(), [date, startTime]);
  const endAtIso = useMemo(
    () => new Date(new Date(`${date}T${startTime}:00`).getTime() + durationMinutes * 60_000).toISOString(),
    [date, startTime, durationMinutes],
  );

  async function placeHold() {
    if (!selectedSeat) return;
    if (!user) {
      router.push(`/login?redirect=/branches/${branch.id}`);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const created = await api.createHold(selectedSeat.id, {
        startAt: startAtIso,
        endAt: endAtIso,
        partySize,
      });
      setHold(created);
      setHoldExpiresAt(Date.now() + 5 * 60_000);
      setAvailability((prev) => new Map(prev).set(selectedSeat.id, "HELD"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not hold that seat.");
    } finally {
      setWorking(false);
    }
  }

  async function confirm() {
    if (!hold) return;
    setWorking(true);
    setError(null);
    try {
      const reservation = await api.confirmReservation({ holdToken: hold.token });
      router.push(`/reservations?highlight=${reservation.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not confirm your reservation.");
    } finally {
      setWorking(false);
    }
  }

  function releaseHold() {
    setHold(null);
    setHoldExpiresAt(0);
    if (selectedSeat) {
      setAvailability((prev) => new Map(prev).set(selectedSeat.id, "AVAILABLE"));
    }
  }

  const hasSearched = availability.size > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{branch.name}</p>
        <h1 className="font-display text-4xl text-ink">Pick your seat</h1>
        <p className="mt-1 text-sm text-steam">{branch.address}</p>
      </div>

      {/* Search controls */}
      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label className="field-label" htmlFor="date">Date</label>
          <input id="date" type="date" className="field-input" value={date} min={defaultDate()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="time">Start</label>
          <input id="time" type="time" className="field-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="duration">Duration</label>
          <select id="duration" className="field-input" value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d >= 60 ? `${d / 60} hr${d > 60 ? "s" : ""}` : `${d} min`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="party">Party size</label>
          <input id="party" type="number" min={1} max={12} className="field-input" value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value)))} />
        </div>
        <Button onClick={search} className="py-2.5" loading={loading}>
          {loading ? "Checking…" : "Check availability"}
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Map + selection */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {(Object.keys(SEAT_STATE_LABEL) as SeatAvailabilityState[])
                .filter((s) => s !== "OCCUPIED")
                .map((state) => (
                  <span key={state} className="flex items-center gap-1.5 text-xs text-steam">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: SEAT_STATE_COLORS[state] }} />
                    {SEAT_STATE_LABEL[state]}
                  </span>
                ))}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setView("isometric")} className={`btn px-3 py-1.5 text-xs ${view === "isometric" ? "btn-primary" : "btn-ghost"}`}>3D</button>
              <button onClick={() => setView("top")} className={`btn px-3 py-1.5 text-xs ${view === "top" ? "btn-primary" : "btn-ghost"}`}>Top</button>
            </div>
          </div>

          <FloorMap3D
            seats={seats}
            availability={availability}
            selectedSeatId={selectedSeat?.id ?? null}
            onSelectSeat={hold ? undefined : setSelectedSeat}
            view={view}
          />
          <p className="text-xs text-steam">
            Drag to orbit · scroll to zoom · tap a green seat to select it.
            {!hasSearched && " Check availability to see live seat status."}
          </p>
        </div>

        {/* Selection / hold panel */}
        <div className="card flex flex-col gap-4 self-start p-6">
          {!selectedSeat && !hold && (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-xl text-ink">No seat selected</h2>
              <p className="text-sm text-steam">
                Choose a date and time, check availability, then pick an open seat on the map.
              </p>
            </div>
          )}

          {selectedSeat && !hold && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">{selectedSeat.name}</h2>
                <p className="text-sm text-steam">{titleCase(selectedSeat.type)} · seats up to {selectedSeat.capacity}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSeat.nearWindow && <Badge className="bg-sage/15 text-sage">Near window</Badge>}
                {selectedSeat.hasPowerOutlet && <Badge className="bg-crema/15 text-crema-deep">Power outlet</Badge>}
                {selectedSeat.quietArea && <Badge className="bg-steam/15 text-steam">Quiet area</Badge>}
              </div>
              <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-steam">Date</dt><dd className="text-ink">{new Date(startAtIso).toLocaleDateString()}</dd></div>
                <div className="flex justify-between"><dt className="text-steam">Time</dt><dd className="text-ink">{startTime} · {durationMinutes / 60} hr</dd></div>
                <div className="flex justify-between"><dt className="text-steam">Party</dt><dd className="text-ink">{partySize}</dd></div>
              </dl>
              <Button variant="accent" onClick={placeHold} className="py-3" loading={working}>
                {working ? "Holding…" : "Hold this seat"}
              </Button>
              <p className="text-center text-xs text-steam">We&apos;ll hold it for 5 minutes while you confirm.</p>
            </div>
          )}

          {hold && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">Seat held</h2>
                <HoldCountdown expiresAt={holdExpiresAt} onExpire={releaseHold} />
              </div>
              <p className="text-sm text-steam">
                {selectedSeat?.name} is yours to confirm. The hold releases automatically when the timer runs out.
              </p>
              <Button onClick={confirm} className="py-3" loading={working}>
                {working ? "Confirming…" : "Confirm reservation"}
              </Button>
              <Button variant="ghost" onClick={releaseHold} className="py-2.5" disabled={working}>
                Release hold
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
