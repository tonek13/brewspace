import type { AvailabilityService } from "../services/availability-service";
import type { HoldRepository } from "../repositories/hold-repository";
import type { SeatRepository } from "../../seats";
import type { BranchRepository } from "../../branches";
import { assertWithinOpeningHours } from "../../branches";
import { serializeAvailability } from "../serializers/availability-serializer";
import { notFound } from "../../../shared/domain-error";
import { seatUnavailable, capacityExceeded, invalidReservationWindow } from "../errors";
import type { AvailabilityQuery, CreateHoldRequest } from "@brewspace/contracts";

export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly holdRepository: HoldRepository,
    private readonly seatRepository: SeatRepository,
    private readonly branchRepository: BranchRepository,
  ) {}

  async list(branchId: string, query: AvailabilityQuery) {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw notFound("Branch");

    const { startAt, endAt } = this.resolveWindow(query.date, query.startTime, query.durationMinutes);
    const hours = await this.branchRepository.findOpeningHours(branchId);
    assertWithinOpeningHours(hours, startAt, endAt, branch.timezone);

    const results = await this.availabilityService.listAvailability(branchId, startAt, endAt, {
      seatType: query.seatType,
      zoneId: query.zoneId,
      nearWindow: query.nearWindow,
      hasPowerOutlet: query.hasPowerOutlet,
      quietArea: query.quietArea,
      minCapacity: query.partySize,
    });

    return { success: true as const, data: results.map(serializeAvailability) };
  }

  async createHold(seatId: string, userId: string, input: CreateHoldRequest) {
    const seat = await this.seatRepository.findById(seatId);
    if (!seat) throw notFound("Seat");
    if (!seat.reservable || seat.status !== "AVAILABLE") throw seatUnavailable();
    if (input.partySize > seat.capacity) throw capacityExceeded(seat.capacity);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (endAt <= startAt) throw invalidReservationWindow("End time must be after start time.");
    if (startAt.getTime() <= Date.now()) throw invalidReservationWindow("Reservation must be in the future.");

    const availability = await this.availabilityService.listAvailability(seat.branchId, startAt, endAt, {});
    const seatAvailability = availability.find((entry) => entry.seat.id === seatId);
    if (!seatAvailability || seatAvailability.state !== "AVAILABLE") throw seatUnavailable();

    const hold = await this.holdRepository.create({
      seatId,
      branchId: seat.branchId,
      userId,
      startAt: input.startAt,
      endAt: input.endAt,
      partySize: input.partySize,
    });
    if (!hold) throw seatUnavailable();

    return { success: true as const, data: hold };
  }

  async releaseHold(seatId: string, token: string) {
    const hold = await this.holdRepository.findByToken(token);
    if (hold && hold.seatId === seatId) await this.holdRepository.release(token);
    return { success: true as const, data: null };
  }

  private resolveWindow(date: string, startTime: string, durationMinutes: number) {
    const startAt = new Date(`${date}T${startTime}:00Z`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    return { startAt, endAt };
  }
}
