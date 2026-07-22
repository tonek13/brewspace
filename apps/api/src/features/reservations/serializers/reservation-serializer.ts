import type { ReservationRecord } from "../repositories/reservation-repository";
import type { ReservationDto } from "@brewspace/contracts";

export function serializeReservation(reservation: ReservationRecord): ReservationDto {
  return {
    id: reservation.id,
    userId: reservation.userId,
    branchId: reservation.branchId,
    seatId: reservation.seatId,
    startAt: reservation.startAt.toISOString(),
    endAt: reservation.endAt.toISOString(),
    partySize: reservation.partySize,
    status: reservation.status,
    reservationCode: reservation.reservationCode,
    notes: reservation.notes,
    checkedInAt: reservation.checkedInAt?.toISOString() ?? null,
    cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
    cancellationReason: reservation.cancellationReason,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}
