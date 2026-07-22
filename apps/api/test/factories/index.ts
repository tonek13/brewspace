import { db } from "../../src/database/client";
import {
  users,
  branches,
  openingHours,
  zones,
  seats,
  reservations,
  staffZoneAssignments,
} from "../../src/database/schema";
import type { UserRole, SeatType, ReservationStatus } from "@brewspace/contracts";
import { PasswordService } from "../../src/features/authentication/services/password-service";

let counter = 0;
const next = () => ++counter;

export async function createUser(overrides: Partial<{
  email: string;
  role: UserRole;
  password: string;
}> = {}) {
  const password = overrides.password ?? "test-password-123";
  const passwordHash = await PasswordService.hash(password);
  const [user] = await db.insert(users).values({
    firstName: "Test",
    lastName: `User${next()}`,
    email: overrides.email ?? `user${next()}-${Date.now()}@example.com`,
    passwordHash,
    role: overrides.role ?? "CUSTOMER",
  }).returning();
  if (!user) throw new Error("factory: user insert failed");
  return { ...user, plainPassword: password };
}

export async function createBranch(overrides: Partial<{ timezone: string }> = {}) {
  const [branch] = await db.insert(branches).values({
    name: `Branch ${next()}`,
    address: "1 Test Street",
    timezone: overrides.timezone ?? "UTC",
  }).returning();
  if (!branch) throw new Error("factory: branch insert failed");

  await db.insert(openingHours).values(
    Array.from({ length: 7 }, (_, day) => ({
      branchId: branch.id,
      dayOfWeek: day,
      opensAt: "07:00",
      closesAt: "22:00",
      closed: false,
    })),
  );
  return branch;
}

export async function createZone(branchId: string) {
  const [zone] = await db.insert(zones).values({
    branchId,
    name: `Zone ${next()}`,
    type: "MAIN_FLOOR",
  }).returning();
  if (!zone) throw new Error("factory: zone insert failed");
  return zone;
}

export async function createSeat(
  branchId: string,
  zoneId: string,
  overrides: Partial<{ capacity: number; type: SeatType; status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE"; reservable: boolean }> = {},
) {
  const [seat] = await db.insert(seats).values({
    branchId,
    zoneId,
    name: `Seat ${next()}`,
    type: overrides.type ?? "TABLE",
    capacity: overrides.capacity ?? 4,
    status: overrides.status ?? "AVAILABLE",
    reservable: overrides.reservable ?? true,
  }).returning();
  if (!seat) throw new Error("factory: seat insert failed");
  return seat;
}

export async function createReservation(input: {
  userId: string;
  branchId: string;
  seatId: string;
  startAt: Date;
  endAt: Date;
  status?: ReservationStatus;
  partySize?: number;
}) {
  const [reservation] = await db.insert(reservations).values({
    userId: input.userId,
    branchId: input.branchId,
    seatId: input.seatId,
    startAt: input.startAt,
    endAt: input.endAt,
    partySize: input.partySize ?? 2,
    status: input.status ?? "CONFIRMED",
    reservationCode: `T${next()}${Date.now().toString(36).toUpperCase()}`.slice(0, 12),
  }).returning();
  if (!reservation) throw new Error("factory: reservation insert failed");
  return reservation;
}

export async function assignWaiterToZone(userId: string, zoneId: string) {
  await db.insert(staffZoneAssignments).values({ userId, zoneId });
}

export function tomorrowAt(hourUtc: number, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(hourUtc, minute, 0, 0);
  return date;
}
