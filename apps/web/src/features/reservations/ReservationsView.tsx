"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReservationDto } from "@brewspace/contracts";
import { api, ApiError } from "@/lib/api-client";
import { Spinner, EmptyState, ErrorNote, Badge } from "@/components/ui";
import { formatDateTime, reservationTone, titleCase } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";

function CheckInForm({ reservation, onDone }: { reservation: ReservationDto; onDone: (r: ReservationDto) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit() {
    setWorking(true);
    setError(null);
    try {
      const updated = await api.checkIn(reservation.id, code.trim().toUpperCase());
      onDone(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check-in failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <label className="field-label" htmlFor={`code-${reservation.id}`}>Enter your reservation code to check in</label>
      <div className="flex gap-2">
        <input
          id={`code-${reservation.id}`}
          className="field-input font-mono uppercase tracking-widest"
          placeholder={reservation.reservationCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={8}
        />
        <button onClick={submit} className="btn btn-primary whitespace-nowrap" disabled={working || code.length < 4}>
          {working ? "…" : "Check in"}
        </button>
      </div>
      <p className="text-xs text-steam">Your code: <span className="font-mono text-ink">{reservation.reservationCode}</span></p>
      {error && <ErrorNote message={error} />}
    </div>
  );
}

export function ReservationsView() {
  const { user, loading: sessionLoading } = useSession();
  const params = useSearchParams();
  const highlight = params.get("highlight");
  const [reservations, setReservations] = useState<ReservationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api.listReservations();
      setReservations(page.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your reservations.");
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [sessionLoading, user, load]);

  function patch(updated: ReservationDto) {
    setReservations((current) => current?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
  }

  async function cancel(reservation: ReservationDto) {
    try {
      const updated = await api.cancelReservation(reservation.id);
      patch(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not cancel.");
    }
  }

  if (sessionLoading) return <Spinner />;
  if (!user)
    return (
      <EmptyState
        title="Sign in to see your reservations"
        hint="Your held and confirmed seats live here once you're signed in."
      />
    );

  if (error) return <ErrorNote message={error} />;
  if (!reservations) return <Spinner label="Loading reservations…" />;
  if (reservations.length === 0)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl text-ink">My reservations</h1>
        <EmptyState title="Nothing booked yet" hint="Find a café and hold your first seat." />
        <Link href="/branches" className="btn btn-accent self-start">Find a seat</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-4xl text-ink">My reservations</h1>
      <div className="flex flex-col gap-4">
        {reservations.map((reservation) => {
          const isActive = reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN";
          const highlighted = highlight === reservation.id;
          return (
            <div
              key={reservation.id}
              className={`card flex flex-col gap-3 p-6 ${highlighted ? "ring-2 ring-crema" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl text-ink">Seat reservation</h2>
                    <Badge className={reservationTone(reservation.status)}>{titleCase(reservation.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-steam">
                    {formatDateTime(reservation.startAt)} → {formatDateTime(reservation.endAt)} · party of {reservation.partySize}
                  </p>
                </div>
              </div>

              {reservation.status === "CONFIRMED" && (
                <CheckInForm reservation={reservation} onDone={patch} />
              )}

              {reservation.status === "CHECKED_IN" && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Link href={`/reservations/${reservation.id}/order`} className="btn btn-accent">Order at the table</Link>
                  <Link href={`/reservations/${reservation.id}/service`} className="btn btn-ghost">Call a waiter</Link>
                </div>
              )}

              {isActive && reservation.status !== "CHECKED_IN" && (
                <div className="flex gap-2">
                  <button onClick={() => cancel(reservation)} className="btn btn-ghost text-clay">Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
