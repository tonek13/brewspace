"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ServiceRequestDto, ServiceRequestType } from "@brewspace/contracts";
import { api, ApiError } from "@/lib/api-client";
import { Spinner, ErrorNote, Badge } from "@/components/ui";
import { requestTone, titleCase, formatTime } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";

const REQUEST_OPTIONS: { type: ServiceRequestType; label: string; hint: string }[] = [
  { type: "CALL_WAITER", label: "Call a waiter", hint: "Someone will come to your table." },
  { type: "REQUEST_WATER", label: "Ask for water", hint: "A refill on the way." },
  { type: "REQUEST_MENU", label: "Bring a menu", hint: "See what's on offer." },
  { type: "REQUEST_ASSISTANCE", label: "Need assistance", hint: "General help." },
  { type: "REQUEST_BILL", label: "Request the bill", hint: "Ready to settle up." },
];

export function ServiceView({ reservationId }: { reservationId: string }) {
  const { user, loading } = useSession();
  const [requests, setRequests] = useState<ServiceRequestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<ServiceRequestType | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    api
      .listReservationServiceRequests(reservationId)
      .then(setRequests)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load requests."));
  }, [loading, user, reservationId]);

  async function send(type: ServiceRequestType) {
    setWorking(type);
    setError(null);
    try {
      const created = await api.createServiceRequest(reservationId, type);
      setRequests((prev) => [created, ...prev]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send that request.");
    } finally {
      setWorking(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="eyebrow">At your table</p>
        <h1 className="font-display text-4xl text-ink">How can we help?</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REQUEST_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => send(option.type)}
            className="card flex flex-col items-start gap-1 p-5 text-left transition-shadow hover:shadow-lift disabled:opacity-60"
            disabled={working !== null}
          >
            <span className="font-display text-lg text-ink">{option.label}</span>
            <span className="text-sm text-steam">{option.hint}</span>
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} />}

      {requests.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl text-ink">Recent requests</h2>
          {requests.map((request) => (
            <div key={request.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-ink">{titleCase(request.type)}</p>
                <p className="text-xs text-steam">{formatTime(request.createdAt)}</p>
              </div>
              <Badge className={requestTone(request.status)}>{titleCase(request.status)}</Badge>
            </div>
          ))}
        </div>
      )}

      <Link href="/reservations" className="btn btn-ghost self-start">Back to my reservations</Link>
    </div>
  );
}
