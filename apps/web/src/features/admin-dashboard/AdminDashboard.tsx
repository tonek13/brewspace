"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type AdminDashboardDto } from "@/lib/api-client";
import { Spinner, ErrorNote, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <span className="text-xs uppercase tracking-wide text-steam">{label}</span>
      <span className="font-display text-3xl text-ink">{value}</span>
    </div>
  );
}

export function AdminDashboard() {
  const { user, loading } = useSession();
  const [data, setData] = useState<AdminDashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || user.role !== "ADMIN") return;
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the dashboard."));
  }, [loading, user]);

  if (loading) return <Spinner />;
  if (!user || user.role !== "ADMIN")
    return <EmptyState title="Admins only" hint="You need an admin account to view this." />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner label="Loading metrics…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="font-display text-4xl text-ink">Admin dashboard</h1>
        </div>
        <Link href="/admin/floor-map" className="btn btn-ghost">Edit floor map</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active reservations" value={data.summary.active_reservations} />
        <Stat label="Checked in now" value={data.summary.active_check_ins} />
        <Stat label="Open requests" value={data.summary.open_requests} />
        <Stat label="Sales today" value={formatMoney(data.summary.daily_sales_cents)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 font-display text-xl text-ink">Most booked seats</h2>
          {data.popularSeats.length === 0 ? (
            <p className="text-sm text-steam">No reservations yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.popularSeats.map((seat) => (
                <li key={seat.id} className="flex justify-between text-sm">
                  <span className="text-ink">{seat.name}</span>
                  <span className="text-steam">{seat.reservation_count} bookings</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-3 font-display text-xl text-ink">Popular menu items</h2>
          {data.popularItems.length === 0 ? (
            <p className="text-sm text-steam">No orders yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.popularItems.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span className="text-ink">{item.name}</span>
                  <span className="text-steam">{item.ordered_quantity} ordered</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
