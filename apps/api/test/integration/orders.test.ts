import { describe, it, expect, beforeEach } from "vitest";
import { request, resetState, registerAndLogin, loginAs } from "../helpers";
import { createUser, createBranch, createZone, createSeat, createReservation, tomorrowAt } from "../factories";
import { db } from "../../src/database/client";
import { menuCategories, menuItems } from "../../src/database/schema";
import { computeTaxCents } from "../../src/features/orders";

async function orderingSetup() {
  const branch = await createBranch();
  const zone = await createZone(branch.id);
  const seat = await createSeat(branch.id, zone.id);
  const { cookie, userId } = await registerAndLogin();
  const reservation = await createReservation({
    userId, branchId: branch.id, seatId: seat.id,
    startAt: tomorrowAt(10), endAt: tomorrowAt(12), status: "CHECKED_IN",
  });

  const [category] = await db.insert(menuCategories).values({
    branchId: branch.id, name: "Coffee", displayOrder: 0,
  }).returning();
  if (!category) throw new Error("category insert failed");
  const [latte] = await db.insert(menuItems).values({
    categoryId: category.id, name: "Latte", priceCents: 450,
  }).returning();
  const [croissant] = await db.insert(menuItems).values({
    categoryId: category.id, name: "Croissant", priceCents: 320,
  }).returning();
  if (!latte || !croissant) throw new Error("item insert failed");

  return { branch, cookie, userId, reservation, category, latte, croissant };
}

describe("orders", () => {
  beforeEach(resetState);

  it("submits an order with exact integer-cents totals", async () => {
    const { cookie, reservation, latte, croissant } = await orderingSetup();
    const response = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie,
      body: { items: [
        { menuItemId: latte.id, quantity: 2 },
        { menuItemId: croissant.id, quantity: 1 },
      ] },
    });

    expect(response.status).toBe(201);
    const data = response.body.data as { subtotalCents: number; taxCents: number; totalCents: number; status: string };
    const expectedSubtotal = 450 * 2 + 320;
    expect(data.subtotalCents).toBe(expectedSubtotal);
    expect(data.taxCents).toBe(computeTaxCents(expectedSubtotal));
    expect(data.totalCents).toBe(expectedSubtotal + data.taxCents);
    expect(data.status).toBe("SUBMITTED");
  });

  it("rejects orders before check-in", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    const seat = await createSeat(branch.id, zone.id);
    const { cookie, userId } = await registerAndLogin();
    const reservation = await createReservation({
      userId, branchId: branch.id, seatId: seat.id,
      startAt: tomorrowAt(10), endAt: tomorrowAt(12), status: "CONFIRMED",
    });
    const [category] = await db.insert(menuCategories).values({ branchId: branch.id, name: "C" }).returning();
    const [item] = await db.insert(menuItems).values({ categoryId: category!.id, name: "X", priceCents: 100 }).returning();

    const response = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie, body: { items: [{ menuItemId: item!.id, quantity: 1 }] },
    });
    expect(response.status).toBe(403);
  });

  it("rejects unavailable menu items", async () => {
    const { cookie, reservation, latte } = await orderingSetup();
    await db.update(menuItems).set({ available: false });
    const response = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie, body: { items: [{ menuItemId: latte.id, quantity: 1 }] },
    });
    expect(response.status).toBe(400);
  });

  it("walks an order through the staff status pipeline and rejects skips", async () => {
    const { cookie, reservation, latte } = await orderingSetup();
    const created = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie, body: { items: [{ menuItemId: latte.id, quantity: 1 }] },
    });
    const orderId = (created.body.data as { id: string }).id;

    const waiter = await createUser({ role: "WAITER" });
    const waiterCookie = await loginAs(waiter.email, waiter.plainPassword);

    const skip = await request("PATCH", `/api/v1/staff/orders/${orderId}/status`, {
      cookie: waiterCookie, body: { status: "READY" },
    });
    expect(skip.status).toBe(409);

    for (const status of ["ACCEPTED", "PREPARING", "READY", "SERVED"] as const) {
      const step = await request("PATCH", `/api/v1/staff/orders/${orderId}/status`, {
        cookie: waiterCookie, body: { status },
      });
      expect(step.status).toBe(200);
      expect((step.body.data as { status: string }).status).toBe(status);
    }
  });

  it("prevents customers from setting operational statuses", async () => {
    const { cookie, reservation, latte } = await orderingSetup();
    const created = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie, body: { items: [{ menuItemId: latte.id, quantity: 1 }] },
    });
    const orderId = (created.body.data as { id: string }).id;
    const response = await request("PATCH", `/api/v1/staff/orders/${orderId}/status`, {
      cookie, body: { status: "SERVED" },
    });
    expect(response.status).toBe(403);
  });

  it("keeps order details private to the owner and staff", async () => {
    const { cookie, reservation, latte } = await orderingSetup();
    const created = await request("POST", `/api/v1/reservations/${reservation.id}/orders`, {
      cookie, body: { items: [{ menuItemId: latte.id, quantity: 1 }] },
    });
    const orderId = (created.body.data as { id: string }).id;

    const owner = await request("GET", `/api/v1/orders/${orderId}`, { cookie });
    expect(owner.status).toBe(200);

    const stranger = await registerAndLogin();
    const denied = await request("GET", `/api/v1/orders/${orderId}`, { cookie: stranger.cookie });
    expect(denied.status).toBe(403);
  });
});

describe("menu", () => {
  beforeEach(resetState);

  it("returns the branch menu and caches it, then invalidates on admin update", async () => {
    const { branch, category, latte } = await orderingSetup();

    const first = await request("GET", `/api/v1/branches/${branch.id}/menu`);
    expect(first.status).toBe(200);
    const menu = first.body.data as { categories: { items: { name: string }[] }[] };
    expect(menu.categories[0]?.items.length).toBe(2);

    const admin = await createUser({ role: "ADMIN" });
    const adminCookie = await loginAs(admin.email, admin.plainPassword);
    const update = await request("PATCH", `/api/v1/admin/menu-items/${latte.id}`, {
      cookie: adminCookie, body: { priceCents: 500 },
    });
    expect(update.status).toBe(200);

    const second = await request("GET", `/api/v1/branches/${branch.id}/menu`);
    const updatedMenu = second.body.data as { categories: { items: { name: string; priceCents: number }[] }[] };
    const updatedLatte = updatedMenu.categories[0]?.items.find((item) => item.name === "Latte");
    expect(updatedLatte?.priceCents).toBe(500);
    void category;
  });

  it("requires the admin role for menu management", async () => {
    const { branch } = await orderingSetup();
    const { cookie } = await registerAndLogin();
    const response = await request("POST", "/api/v1/admin/menu-categories", {
      cookie, body: { branchId: branch.id, name: "Snacks" },
    });
    expect(response.status).toBe(403);
  });
});
