"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { OrderView } from "@/features/orders/OrderView";
import { Spinner, ErrorNote } from "@/components/ui";
import { useSession } from "@/features/authentication/session-context";

export default function OrderPage({ params }: { params: { reservationId: string } }) {
  const { user, loading } = useSession();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    api
      .listReservations()
      .then((page) => {
        const match = page.items.find((r) => r.id === params.reservationId);
        if (!match) setError("Reservation not found.");
        else setBranchId(match.branchId);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load reservation."));
  }, [loading, user, params.reservationId]);

  if (loading || (!branchId && !error)) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  if (!branchId) return null;
  return <OrderView reservationId={params.reservationId} branchId={branchId} />;
}
