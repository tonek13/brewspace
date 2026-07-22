"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceRequestDto, ServiceRequestStatus, BranchDto } from "@brewspace/contracts";
import { api, ApiError, type OrderDto } from "@/lib/api-client";
import { Spinner, ErrorNote, EmptyState, Badge, Button } from "@/components/ui";
import { requestTone, orderTone, titleCase, formatTime, formatMoney } from "@/lib/format";
import { useSession } from "@/features/authentication/session-context";
import { useBranchEvents } from "@/hooks/useBranchEvents";

const NEXT_REQUEST_STATUS: Partial<Record<ServiceRequestStatus, { to: ServiceRequestStatus; label: string }>> = {
  PENDING: { to: "ACCEPTED", label: "Accept" },
  ACCEPTED: { to: "IN_PROGRESS", label: "Start" },
  IN_PROGRESS: { to: "COMPLETED", label: "Complete" },
};

export function StaffDashboard() {
  const { user, loading } = useSession();
  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [requests, setRequests] = useState<ServiceRequestDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [reqs, ords] = await Promise.all([api.listStaffServiceRequests(), api.listStaffOrders()]);
      setRequests(reqs);
      setOrders(ords);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    api.listBranches().then((list) => setBranch(list[0] ?? null)).catch(() => undefined);
    void refresh();
  }, [loading, user, refresh]);

  useBranchEvents(branch?.id ?? null, refresh);

  async function advanceRequest(request: ServiceRequestDto) {
    const next = NEXT_REQUEST_STATUS[request.status];
    if (!next) return;
    setBusyId(request.id);
    try {
      const updated = await api.updateServiceRequestStatus(request.id, next.to);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)).filter((r) => r.status !== "COMPLETED"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update request.");
    } finally {
      setBusyId(null);
    }
  }

  async function advanceOrder(order: OrderDto, to: OrderDto["status"]) {
    setBusyId(order.id);
    try {
      const updated = await api.updateOrderStatus(order.id, to);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)).filter((o) => o.status !== "SERVED"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update order.");
    } finally {
      setBusyId(null);
    }
  }

  const ORDER_NEXT: Partial<Record<OrderDto["status"], { to: OrderDto["status"]; label: string }>> = {
    SUBMITTED: { to: "ACCEPTED", label: "Accept" },
    ACCEPTED: { to: "PREPARING", label: "Prepare" },
    PREPARING: { to: "READY", label: "Ready" },
    READY: { to: "SERVED", label: "Served" },
  };

  if (loading) return <Spinner />;
  if (!user || (user.role !== "WAITER" && user.role !== "ADMIN"))
    return <EmptyState title="Staff only" hint="This dashboard is for waiters and admins." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Live queue{branch ? ` · ${branch.name}` : ""}</p>
          <h1 className="font-display text-4xl text-ink">Staff dashboard</h1>
        </div>
        <span className="flex items-center gap-2 text-xs text-steam">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sage" /> Live
        </span>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl text-ink">Service requests</h2>
          {requests.length === 0 ? (
            <EmptyState title="All caught up" hint="New requests appear here in real time." />
          ) : (
            requests.map((request) => {
              const next = NEXT_REQUEST_STATUS[request.status];
              return (
                <div key={request.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{titleCase(request.type)}</p>
                      <Badge className={requestTone(request.status)}>{titleCase(request.status)}</Badge>
                    </div>
                    <p className="text-xs text-steam">{formatTime(request.createdAt)}</p>
                    {request.message && <p className="mt-1 text-sm text-steam">“{request.message}”</p>}
                  </div>
                  {next && (
                    <Button
                      onClick={() => advanceRequest(request)}
                      className="whitespace-nowrap"
                      loading={busyId === request.id}
                    >
                      {next.label}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl text-ink">Orders</h2>
          {orders.length === 0 ? (
            <EmptyState title="No active orders" hint="Submitted orders show up here." />
          ) : (
            orders.map((order) => {
              const next = ORDER_NEXT[order.status];
              return (
                <div key={order.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{formatMoney(order.totalCents)}</p>
                      <Badge className={orderTone(order.status)}>{titleCase(order.status)}</Badge>
                    </div>
                    <p className="text-xs text-steam">{formatTime(order.createdAt)}</p>
                  </div>
                  {next && (
                    <Button
                      onClick={() => advanceOrder(order, next.to)}
                      className="whitespace-nowrap"
                      loading={busyId === order.id}
                    >
                      {next.label}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
