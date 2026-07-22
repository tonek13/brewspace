import type { ReservationService } from "../services/reservation-service";
import { serializeReservation } from "../serializers/reservation-serializer";
import { buildPaginatedResult } from "../../../shared/pagination";
import type {
  CreateReservationRequest,
  CancelReservationRequest,
  ExtendReservationRequest,
  CheckInRequest,
} from "@brewspace/contracts";
import type { ReservationRepository } from "../repositories/reservation-repository";

export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly reservationRepository: ReservationRepository,
  ) {}

  async confirm(userId: string, input: CreateReservationRequest) {
    const reservation = await this.reservationService.confirm(userId, input.holdToken, input.notes);
    return { success: true as const, data: serializeReservation(reservation) };
  }

  async list(userId: string, page: number, pageSize: number) {
    const { items, total } = await this.reservationRepository.findMany({ userId }, page, pageSize);
    const result = buildPaginatedResult(items.map(serializeReservation), total, page, pageSize);
    return { success: true as const, data: result };
  }

  async getById(reservationId: string, requester: { userId: string; role: string }) {
    const reservation = await this.reservationService.get(reservationId, requester);
    return { success: true as const, data: serializeReservation(reservation) };
  }

  async cancel(reservationId: string, requester: { userId: string; role: string }, input: CancelReservationRequest) {
    const reservation = await this.reservationService.cancel(reservationId, requester, input.reason);
    return { success: true as const, data: serializeReservation(reservation) };
  }

  async extend(reservationId: string, requester: { userId: string; role: string }, input: ExtendReservationRequest) {
    const reservation = await this.reservationService.extend(
      reservationId,
      requester,
      new Date(input.newEndAt),
    );
    return { success: true as const, data: serializeReservation(reservation) };
  }

  async checkIn(userId: string, input: CheckInRequest) {
    const reservation = await this.reservationService.checkIn(userId, input.reservationCode);
    return { success: true as const, data: serializeReservation(reservation) };
  }
}
