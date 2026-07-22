import { describe, it, expect, beforeEach } from "vitest";
import { request, resetState, registerAndLogin } from "../helpers";
import { createUser, createBranch, createZone, createSeat, createReservation, tomorrowAt } from "../factories";

function tomorrowDateString(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe("GET /api/v1/branches/:branchId/availability", () => {
  beforeEach(resetState);

  it("marks free seats AVAILABLE and overlapping ones RESERVED", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    const freeSeat = await createSeat(branch.id, zone.id);
    const busySeat = await createSeat(branch.id, zone.id);
    const owner = await createUser();
    await createReservation({
      userId: owner.id, branchId: branch.id, seatId: busySeat.id,
      startAt: tomorrowAt(10), endAt: tomorrowAt(12),
    });

    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=${tomorrowDateString()}&startTime=10:00&durationMinutes=60&partySize=2`,
    );
    expect(response.status).toBe(200);
    const data = response.body.data as { seat: { id: string }; state: string }[];
    const states = Object.fromEntries(data.map((entry) => [entry.seat.id, entry.state]));
    expect(states[freeSeat.id]).toBe("AVAILABLE");
    expect(states[busySeat.id]).toBe("RESERVED");
  });

  it("shows AVAILABLE again for a non-overlapping window", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    const seat = await createSeat(branch.id, zone.id);
    const owner = await createUser();
    await createReservation({
      userId: owner.id, branchId: branch.id, seatId: seat.id,
      startAt: tomorrowAt(10), endAt: tomorrowAt(11),
    });

    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=${tomorrowDateString()}&startTime=13:00&durationMinutes=60&partySize=2`,
    );
    const data = response.body.data as { seat: { id: string }; state: string }[];
    expect(data[0]?.state).toBe("AVAILABLE");
  });

  it("filters out seats below the requested capacity", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    await createSeat(branch.id, zone.id, { capacity: 2 });
    const bigSeat = await createSeat(branch.id, zone.id, { capacity: 8 });

    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=${tomorrowDateString()}&startTime=10:00&durationMinutes=60&partySize=6`,
    );
    const data = response.body.data as { seat: { id: string } }[];
    expect(data).toHaveLength(1);
    expect(data[0]?.seat.id).toBe(bigSeat.id);
  });

  it("reports HELD after another customer places a hold", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    const seat = await createSeat(branch.id, zone.id);
    const { cookie } = await registerAndLogin();
    await request("POST", `/api/v1/seats/${seat.id}/holds`, {
      cookie,
      body: { startAt: tomorrowAt(10).toISOString(), endAt: tomorrowAt(11).toISOString(), partySize: 2 },
    });

    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=${tomorrowDateString()}&startTime=10:00&durationMinutes=60&partySize=2`,
    );
    const data = response.body.data as { state: string }[];
    expect(data[0]?.state).toBe("HELD");
  });

  it("rejects a window outside opening hours", async () => {
    const branch = await createBranch();
    const zone = await createZone(branch.id);
    await createSeat(branch.id, zone.id);

    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=${tomorrowDateString()}&startTime=23:00&durationMinutes=60&partySize=2`,
    );
    expect(response.status).toBe(422);
    expect((response.body.error as { code: string }).code).toBe("OUTSIDE_OPENING_HOURS");
  });

  it("returns 404 for an unknown branch", async () => {
    const response = await request(
      "GET",
      `/api/v1/branches/${crypto.randomUUID()}/availability?date=${tomorrowDateString()}&startTime=10:00&durationMinutes=60&partySize=2`,
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed query parameters", async () => {
    const branch = await createBranch();
    const response = await request(
      "GET",
      `/api/v1/branches/${branch.id}/availability?date=not-a-date&startTime=10:00&durationMinutes=60&partySize=2`,
    );
    expect(response.status).toBe(400);
  });
});

describe("branches endpoints", () => {
  beforeEach(resetState);

  it("lists active branches", async () => {
    await createBranch();
    const response = await request("GET", "/api/v1/branches");
    expect(response.status).toBe(200);
    expect((response.body.data as unknown[]).length).toBe(1);
  });

  it("returns opening hours for a branch", async () => {
    const branch = await createBranch();
    const response = await request("GET", `/api/v1/branches/${branch.id}/opening-hours`);
    expect(response.status).toBe(200);
    expect((response.body.data as unknown[]).length).toBe(7);
  });

  it("returns 404 for an unknown branch id", async () => {
    const response = await request("GET", `/api/v1/branches/${crypto.randomUUID()}`);
    expect(response.status).toBe(404);
  });
});
