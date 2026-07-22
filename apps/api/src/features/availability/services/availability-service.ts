import { and, eq, inArray, lt, gt } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { reservations } from "../../../database/schema";
import type { SeatRepository, SeatRecord, SeatFilter } from "../../seats";
import type { HoldRepository } from "../repositories/hold-repository";
import type { SeatAvailabilityState } from "@brewspace/contracts";

export interface SeatAvailability {
  seat: SeatRecord;
  state: SeatAvailabilityState;
}

const ACTIVE_RESERVATION_STATUSES = ["HELD", "CONFIRMED", "CHECKED_IN"] as const;

export class AvailabilityService {
  constructor(
    private readonly db: Database,
    private readonly seatRepository: SeatRepository,
    private readonly holdRepository: HoldRepository,
  ) {}

  async listAvailability(
    branchId: string,
    startAt: Date,
    endAt: Date,
    filter: SeatFilter,
  ): Promise<SeatAvailability[]> {
    const seats = await this.seatRepository.findByBranch(branchId, filter);
    if (seats.length === 0) return [];

    const seatIds = seats.map((seat) => seat.id);
    const overlapping = await this.db
      .select({ seatId: reservations.seatId })
      .from(reservations)
      .where(
        and(
          inArray(reservations.seatId, seatIds),
          inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
          lt(reservations.startAt, endAt),
          gt(reservations.endAt, startAt),
        ),
      );
    const reservedSeatIds = new Set(overlapping.map((row) => row.seatId));

    const results: SeatAvailability[] = [];
    for (const seat of seats) {
      results.push({ seat, state: await this.resolveState(seat, reservedSeatIds) });
    }
    return results;
  }

  private async resolveState(
    seat: SeatRecord,
    reservedSeatIds: Set<string>,
  ): Promise<SeatAvailabilityState> {
    if (seat.status === "MAINTENANCE") return "MAINTENANCE";
    if (seat.status === "UNAVAILABLE") return "UNAVAILABLE";
    if (reservedSeatIds.has(seat.id)) return "RESERVED";

    const hold = await this.holdRepository.findActiveForSeat(seat.branchId, seat.id);
    if (hold) return "HELD";

    return "AVAILABLE";
  }
}
