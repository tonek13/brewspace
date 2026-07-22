"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, type BranchMenuDto, type MenuItemDto, type OrderDto } from "@/lib/api-client";
import { Spinner, ErrorNote, EmptyState, Button } from "@/components/ui";
import { formatMoney, orderTone, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui";
import { useSession } from "@/features/authentication/session-context";

const TAX_RATE = 0.1;

export function OrderView({ reservationId, branchId }: { reservationId: string; branchId: string }) {
  const { user, loading } = useSession();
  const [menu, setMenu] = useState<BranchMenuDto | null>(null);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [placed, setPlaced] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    api
      .getMenu(branchId)
      .then(setMenu)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the menu."));
  }, [branchId]);

  const itemsById = useMemo(() => {
    const map = new Map<string, MenuItemDto>();
    menu?.categories.forEach((c) => c.items.forEach((i) => map.set(i.id, i)));
    return map;
  }, [menu]);

  const subtotal = useMemo(() => {
    let sum = 0;
    cart.forEach((qty, id) => {
      const item = itemsById.get(id);
      if (item) sum += item.priceCents * qty;
    });
    return sum;
  }, [cart, itemsById]);

  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  }

  async function placeOrder() {
    setWorking(true);
    setError(null);
    try {
      const items = Array.from(cart.entries()).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const order = await api.submitOrder(reservationId, { items });
      setPlaced(order);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not place your order.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Spinner />;
  if (!user) return <EmptyState title="Sign in to order" />;

  if (placed) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card flex flex-col gap-3 p-8 text-center">
          <p className="eyebrow">Order placed</p>
          <h1 className="font-display text-3xl text-ink">Sent to the kitchen</h1>
          <div className="flex items-center justify-center gap-2">
            <Badge className={orderTone(placed.status)}>{titleCase(placed.status)}</Badge>
            <span className="text-sm text-steam">Total {formatMoney(placed.totalCents)}</span>
          </div>
          <p className="text-sm text-steam">A waiter will bring your order to the table shortly.</p>
          <Link href="/reservations" className="btn btn-primary mt-2">Back to my reservations</Link>
        </div>
      </div>
    );
  }

  if (error && !menu) return <ErrorNote message={error} />;
  if (!menu) return <Spinner label="Loading menu…" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div className="flex flex-col gap-6">
        <div>
          <p className="eyebrow">Order at the table</p>
          <h1 className="font-display text-4xl text-ink">Menu</h1>
        </div>
        {menu.categories.map((category) => (
          <div key={category.id} className="flex flex-col gap-3">
            <h2 className="font-display text-2xl text-ink">{category.name}</h2>
            <div className="flex flex-col gap-2">
              {category.items.map((item) => {
                const qty = cart.get(item.id) ?? 0;
                return (
                  <div key={item.id} className="card flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium text-ink">{item.name}</p>
                      {item.description && <p className="text-sm text-steam">{item.description}</p>}
                      <p className="mt-0.5 text-sm text-crema-deep">{formatMoney(item.priceCents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(item.id, qty - 1)} className="btn btn-ghost h-8 w-8 p-0" aria-label={`Remove one ${item.name}`} disabled={qty === 0}>–</button>
                      <span className="w-6 text-center font-mono text-sm">{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)} className="btn btn-ghost h-8 w-8 p-0" aria-label={`Add one ${item.name}`}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="card sticky top-20 flex flex-col gap-3 p-6">
        <h2 className="font-display text-xl text-ink">Your order</h2>
        {cart.size === 0 ? (
          <p className="text-sm text-steam">Add items from the menu to get started.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5 border-b border-line pb-3 text-sm">
              {Array.from(cart.entries()).map(([id, qty]) => {
                const item = itemsById.get(id);
                if (!item) return null;
                return (
                  <li key={id} className="flex justify-between">
                    <span className="text-ink">{qty} × {item.name}</span>
                    <span className="text-steam">{formatMoney(item.priceCents * qty)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between"><dt className="text-steam">Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-steam">Tax (10%)</dt><dd>{formatMoney(tax)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1 font-medium"><dt>Total</dt><dd>{formatMoney(total)}</dd></div>
            </dl>
            {error && <ErrorNote message={error} />}
            <Button variant="accent" onClick={placeOrder} className="py-3" loading={working}>
              {working ? "Placing…" : "Place order"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
