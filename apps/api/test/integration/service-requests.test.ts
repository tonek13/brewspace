import { describe, it, expect, beforeEach } from "vitest";
import { request, resetState, registerAndLogin, loginAs } from "../helpers";
import {
  createUser, createBranch, createZone, createSeat, createReservation,
  assignWaiterToZone, tomorrowAt,
} from "../factories";

async function checkedInSetup() {
  const branch = await createBranch();
  const zone = await createZone(branch.id);
  const seat = await createSeat(branch.id, zone.id);
  const { cookie, userId } = await registerAndLogin();
  const reservation = await createReservation({
    userId, branchId: branch.id, seatId: seat.id,
    startAt: tomorrowAt(10), endAt: tomorrowAt(12), status: "CHECKED_IN",
  });
  return { branch, zone, seat, cookie, userId, reservation };
}

describe("service requests", () => {
  beforeEach(resetState);

  describe("POST /api/v1/reservations/:id/service-requests", () => {
    it("creates a waiter call for a checked-in reservation", async () => {
      const { cookie, reservation, zone } = await checkedInSetup();
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "CALL_WAITER", message: "Extra napkins please" },
      });
      expect(response.status).toBe(201);
      const data = response.body.data as { status: string; zoneId: string; type: string };
      expect(data.status).toBe("PENDING");
      expect(data.zoneId).toBe(zone.id);
      expect(data.type).toBe("CALL_WAITER");
    });

    it("rejects requests for a reservation that is only confirmed", async () => {
      const branch = await createBranch();
      const zone = await createZone(branch.id);
      const seat = await createSeat(branch.id, zone.id);
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id,
        startAt: tomorrowAt(10), endAt: tomorrowAt(12), status: "CONFIRMED",
      });
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "CALL_WAITER" },
      });
      expect(response.status).toBe(403);
    });

    it("blocks a second active bill request", async () => {
      const { cookie, reservation } = await checkedInSetup();
      const first = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "REQUEST_BILL" },
      });
      expect(first.status).toBe(201);
      const second = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "REQUEST_BILL" },
      });
      expect(second.status).toBe(409);
      expect((second.body.error as { code: string }).code).toBe("DUPLICATE_BILL_REQUEST");
    });

    it("rejects a request on another customer's reservation", async () => {
      const { reservation } = await checkedInSetup();
      const stranger = await registerAndLogin();
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie: stranger.cookie, body: { type: "REQUEST_WATER" },
      });
      expect(response.status).toBe(403);
    });
  });

  describe("staff queue and transitions", () => {
    it("shows zone requests only to waiters assigned to that zone", async () => {
      const { cookie, reservation, zone } = await checkedInSetup();
      await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "CALL_WAITER" },
      });

      const assigned = await createUser({ role: "WAITER" });
      await assignWaiterToZone(assigned.id, zone.id);
      const unassigned = await createUser({ role: "WAITER" });

      const assignedCookie = await loginAs(assigned.email, assigned.plainPassword);
      const unassignedCookie = await loginAs(unassigned.email, unassigned.plainPassword);

      const assignedList = await request("GET", "/api/v1/staff/service-requests", { cookie: assignedCookie });
      const unassignedList = await request("GET", "/api/v1/staff/service-requests", { cookie: unassignedCookie });

      expect((assignedList.body.data as unknown[]).length).toBe(1);
      expect((unassignedList.body.data as unknown[]).length).toBe(0);
    });

    it("blocks customers from the staff queue", async () => {
      const { cookie } = await registerAndLogin();
      const response = await request("GET", "/api/v1/staff/service-requests", { cookie });
      expect(response.status).toBe(403);
    });

    it("walks a request through accept -> in progress -> complete", async () => {
      const { cookie, reservation, zone } = await checkedInSetup();
      const created = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "REQUEST_WATER" },
      });
      const requestId = (created.body.data as { id: string }).id;

      const waiter = await createUser({ role: "WAITER" });
      await assignWaiterToZone(waiter.id, zone.id);
      const waiterCookie = await loginAs(waiter.email, waiter.plainPassword);

      const accept = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: waiterCookie, body: { status: "ACCEPTED" },
      });
      expect(accept.status).toBe(200);
      expect((accept.body.data as { assignedWaiterId: string }).assignedWaiterId).toBe(waiter.id);

      const progress = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: waiterCookie, body: { status: "IN_PROGRESS" },
      });
      expect(progress.status).toBe(200);

      const complete = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: waiterCookie, body: { status: "COMPLETED" },
      });
      expect(complete.status).toBe(200);
      expect((complete.body.data as { completedAt: string | null }).completedAt).not.toBeNull();
    });

    it("rejects an invalid transition (pending -> completed)", async () => {
      const { cookie, reservation, zone } = await checkedInSetup();
      const created = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "REQUEST_MENU" },
      });
      const requestId = (created.body.data as { id: string }).id;

      const waiter = await createUser({ role: "WAITER" });
      await assignWaiterToZone(waiter.id, zone.id);
      const waiterCookie = await loginAs(waiter.email, waiter.plainPassword);

      const response = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: waiterCookie, body: { status: "COMPLETED" },
      });
      expect(response.status).toBe(409);
    });

    it("blocks a waiter from another zone, but allows an admin", async () => {
      const { cookie, reservation } = await checkedInSetup();
      const created = await request("POST", `/api/v1/reservations/${reservation.id}/service-requests`, {
        cookie, body: { type: "CALL_WAITER" },
      });
      const requestId = (created.body.data as { id: string }).id;

      const outsider = await createUser({ role: "WAITER" });
      const outsiderCookie = await loginAs(outsider.email, outsider.plainPassword);
      const denied = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: outsiderCookie, body: { status: "ACCEPTED" },
      });
      expect(denied.status).toBe(403);

      const admin = await createUser({ role: "ADMIN" });
      const adminCookie = await loginAs(admin.email, admin.plainPassword);
      const allowed = await request("PATCH", `/api/v1/staff/service-requests/${requestId}/status`, {
        cookie: adminCookie, body: { status: "ACCEPTED" },
      });
      expect(allowed.status).toBe(200);
    });
  });
});
