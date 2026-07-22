import { describe, it, expect, beforeEach } from "vitest";
import { request, resetState, registerAndLogin } from "../helpers";
import { createUser, createBranch, createZone, createSeat, createReservation, tomorrowAt } from "../factories";
import { loginAs } from "../helpers";

async function setupVenue() {
  const branch = await createBranch();
  const zone = await createZone(branch.id);
  const seat = await createSeat(branch.id, zone.id, { capacity: 4 });
  return { branch, zone, seat };
}

async function createHoldFor(cookie: string, seatId: string, startAt: Date, endAt: Date, partySize = 2) {
  return request("POST", `/api/v1/seats/${seatId}/holds`, {
    cookie,
    body: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), partySize },
  });
}

describe("holds and reservations", () => {
  beforeEach(resetState);

  describe("POST /api/v1/seats/:seatId/holds", () => {
    it("creates a five-minute hold for an available seat", async () => {
      const { seat } = await setupVenue();
      const { cookie } = await registerAndLogin();
      const response = await createHoldFor(cookie, seat.id, tomorrowAt(10), tomorrowAt(11));

      expect(response.status).toBe(200);
      const data = response.body.data as { token: string; seatId: string };
      expect(data.seatId).toBe(seat.id);
      expect(data.token.length).toBeGreaterThan(10);
    });

    it("requires authentication", async () => {
      const { seat } = await setupVenue();
      const response = await request("POST", `/api/v1/seats/${seat.id}/holds`, {
        body: { startAt: tomorrowAt(10).toISOString(), endAt: tomorrowAt(11).toISOString(), partySize: 2 },
      });
      expect(response.status).toBe(401);
    });

    it("rejects a party size larger than the seat capacity", async () => {
      const { seat } = await setupVenue();
      const { cookie } = await registerAndLogin();
      const response = await createHoldFor(cookie, seat.id, tomorrowAt(10), tomorrowAt(11), 9);
      expect(response.status).toBe(422);
      expect((response.body.error as { code: string }).code).toBe("CAPACITY_EXCEEDED");
    });

    it("rejects a hold on a seat under maintenance", async () => {
      const branch = await createBranch();
      const zone = await createZone(branch.id);
      const seat = await createSeat(branch.id, zone.id, { status: "MAINTENANCE" });
      const { cookie } = await registerAndLogin();
      const response = await createHoldFor(cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      expect(response.status).toBe(409);
      expect((response.body.error as { code: string }).code).toBe("SEAT_UNAVAILABLE");
    });

    it("rejects a hold in the past", async () => {
      const { seat } = await setupVenue();
      const { cookie } = await registerAndLogin();
      const past = new Date(Date.now() - 3_600_000);
      const pastEnd = new Date(Date.now() - 1_800_000);
      const response = await createHoldFor(cookie, seat.id, past, pastEnd);
      expect(response.status).toBe(400);
    });

    it("rejects a second hold on the same seat while one is active", async () => {
      const { seat } = await setupVenue();
      const first = await registerAndLogin();
      const second = await registerAndLogin();

      const firstHold = await createHoldFor(first.cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      expect(firstHold.status).toBe(200);

      const secondHold = await createHoldFor(second.cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      expect(secondHold.status).toBe(409);
    });

    it("rejects a hold overlapping an existing confirmed reservation", async () => {
      const { branch, seat } = await setupVenue();
      const owner = await createUser();
      await createReservation({
        userId: owner.id,
        branchId: branch.id,
        seatId: seat.id,
        startAt: tomorrowAt(10),
        endAt: tomorrowAt(12),
      });

      const { cookie } = await registerAndLogin();
      const response = await createHoldFor(cookie, seat.id, tomorrowAt(11), tomorrowAt(13));
      expect(response.status).toBe(409);
    });
  });

  describe("POST /api/v1/reservations", () => {
    it("confirms a reservation from a valid hold", async () => {
      const { seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const hold = await createHoldFor(cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      const token = (hold.body.data as { token: string }).token;

      const response = await request("POST", "/api/v1/reservations", { cookie, body: { holdToken: token } });
      expect(response.status).toBe(201);
      const data = response.body.data as { status: string; userId: string; reservationCode: string };
      expect(data.status).toBe("CONFIRMED");
      expect(data.userId).toBe(userId);
      expect(data.reservationCode).toHaveLength(8);
    });

    it("rejects an expired or unknown hold token", async () => {
      await setupVenue();
      const { cookie } = await registerAndLogin();
      const response = await request("POST", "/api/v1/reservations", {
        cookie,
        body: { holdToken: "nonexistent-token-value" },
      });
      expect(response.status).toBe(404);
      expect((response.body.error as { code: string }).code).toBe("HOLD_NOT_FOUND");
    });

    it("rejects confirming another customer's hold", async () => {
      const { seat } = await setupVenue();
      const holder = await registerAndLogin();
      const thief = await registerAndLogin();
      const hold = await createHoldFor(holder.cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      const token = (hold.body.data as { token: string }).token;

      const response = await request("POST", "/api/v1/reservations", {
        cookie: thief.cookie,
        body: { holdToken: token },
      });
      expect(response.status).toBe(403);
    });

    it("a consumed hold cannot be reused", async () => {
      const { seat } = await setupVenue();
      const { cookie } = await registerAndLogin();
      const hold = await createHoldFor(cookie, seat.id, tomorrowAt(10), tomorrowAt(11));
      const token = (hold.body.data as { token: string }).token;

      const first = await request("POST", "/api/v1/reservations", { cookie, body: { holdToken: token } });
      expect(first.status).toBe(201);
      const second = await request("POST", "/api/v1/reservations", { cookie, body: { holdToken: token } });
      expect(second.status).toBe(404);
    });

    it("two racing confirms on overlapping windows produce exactly one reservation", async () => {
      const { branch, seat } = await setupVenue();
      const alice = await registerAndLogin();
      const bob = await registerAndLogin();

      // Bypass the single-active-hold-per-seat guard by seeding two holds directly in Redis,
      // simulating the race where one hold expires from the seat key but both tokens survive.
      const { holdRepository } = await import("../../src/features/availability");
      const { redis } = await import("../../src/infrastructure/redis");
      const { redisKeys } = await import("../../src/infrastructure/redis");

      const makeHold = async (userId: string) => {
        const token = crypto.randomUUID();
        const payload = JSON.stringify({
          token,
          seatId: seat.id,
          branchId: branch.id,
          userId,
          startAt: tomorrowAt(14).toISOString(),
          endAt: tomorrowAt(15).toISOString(),
          partySize: 2,
        });
        await redis.set(redisKeys.holdToken(token), payload, "EX", 300);
        return token;
      };

      const aliceToken = await makeHold(alice.userId);
      const bobToken = await makeHold(bob.userId);

      const [first, second] = await Promise.all([
        request("POST", "/api/v1/reservations", { cookie: alice.cookie, body: { holdToken: aliceToken } }),
        request("POST", "/api/v1/reservations", { cookie: bob.cookie, body: { holdToken: bobToken } }),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  describe("cancellations", () => {
    it("lets the owner cancel a confirmed reservation", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });

      const response = await request("POST", `/api/v1/reservations/${reservation.id}/cancellations`, {
        cookie, body: { reason: "Change of plans" },
      });
      expect(response.status).toBe(200);
      const data = response.body.data as { status: string; cancellationReason: string };
      expect(data.status).toBe("CANCELLED");
      expect(data.cancellationReason).toBe("Change of plans");
    });

    it("prevents a stranger from cancelling", async () => {
      const { branch, seat } = await setupVenue();
      const owner = await createUser();
      const reservation = await createReservation({
        userId: owner.id, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const stranger = await registerAndLogin();
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/cancellations`, {
        cookie: stranger.cookie, body: {},
      });
      expect(response.status).toBe(403);
    });

    it("allows an admin to cancel any reservation", async () => {
      const { branch, seat } = await setupVenue();
      const owner = await createUser();
      const admin = await createUser({ role: "ADMIN" });
      const reservation = await createReservation({
        userId: owner.id, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const cookie = await loginAs(admin.email, admin.plainPassword);
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/cancellations`, {
        cookie, body: {},
      });
      expect(response.status).toBe(200);
    });

    it("refuses to cancel a checked-in reservation", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
        status: "CHECKED_IN",
      });
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/cancellations`, {
        cookie, body: {},
      });
      expect(response.status).toBe(409);
      expect((response.body.error as { code: string }).code).toBe("INVALID_STATE_TRANSITION");
    });

    it("returns 404 for an unknown reservation", async () => {
      const { cookie } = await registerAndLogin();
      const response = await request("POST", `/api/v1/reservations/${crypto.randomUUID()}/cancellations`, {
        cookie, body: {},
      });
      expect(response.status).toBe(404);
    });
  });

  describe("extensions", () => {
    it("extends a reservation when the seat stays free", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/extensions`, {
        cookie, body: { newEndAt: tomorrowAt(12).toISOString() },
      });
      expect(response.status).toBe(200);
      expect((response.body.data as { endAt: string }).endAt).toBe(tomorrowAt(12).toISOString());
    });

    it("rejects an extension colliding with the next reservation", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const mine = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const other = await createUser();
      await createReservation({
        userId: other.id, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(11), endAt: tomorrowAt(12),
      });
      const response = await request("POST", `/api/v1/reservations/${mine.id}/extensions`, {
        cookie, body: { newEndAt: tomorrowAt(11, 30).toISOString() },
      });
      expect(response.status).toBe(409);
    });
  });

  describe("check-ins", () => {
    it("checks in with a valid code", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/check-ins`, {
        cookie, body: { reservationCode: reservation.reservationCode },
      });
      expect(response.status).toBe(200);
      const data = response.body.data as { status: string; checkedInAt: string | null };
      expect(data.status).toBe("CHECKED_IN");
      expect(data.checkedInAt).not.toBeNull();
    });

    it("prevents checking in someone else's reservation", async () => {
      const { branch, seat } = await setupVenue();
      const owner = await createUser();
      const reservation = await createReservation({
        userId: owner.id, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
      });
      const stranger = await registerAndLogin();
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/check-ins`, {
        cookie: stranger.cookie, body: { reservationCode: reservation.reservationCode },
      });
      expect(response.status).toBe(403);
    });

    it("rejects double check-in", async () => {
      const { branch, seat } = await setupVenue();
      const { cookie, userId } = await registerAndLogin();
      const reservation = await createReservation({
        userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(10), endAt: tomorrowAt(11),
        status: "CHECKED_IN",
      });
      const response = await request("POST", `/api/v1/reservations/${reservation.id}/check-ins`, {
        cookie, body: { reservationCode: reservation.reservationCode },
      });
      expect(response.status).toBe(409);
    });
  });

  describe("GET /api/v1/reservations", () => {
    it("lists only the caller's reservations with pagination", async () => {
      const { branch, seat } = await setupVenue();
      const zone2 = await createZone(branch.id);
      const otherSeat = await createSeat(branch.id, zone2.id);
      const { cookie, userId } = await registerAndLogin();
      const other = await createUser();

      await createReservation({ userId, branchId: branch.id, seatId: seat.id, startAt: tomorrowAt(9), endAt: tomorrowAt(10) });
      await createReservation({ userId: other.id, branchId: branch.id, seatId: otherSeat.id, startAt: tomorrowAt(9), endAt: tomorrowAt(10) });

      const response = await request("GET", "/api/v1/reservations?page=1&pageSize=10", { cookie });
      expect(response.status).toBe(200);
      const data = response.body.data as { items: { userId: string }[]; totalItems: number };
      expect(data.totalItems).toBe(1);
      expect(data.items.every((r) => r.userId === userId)).toBe(true);
    });
  });
});
