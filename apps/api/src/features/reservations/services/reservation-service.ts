import { RESERVATION_TRANSITIONS, canTransition } from "@brewspace/contracts";
import type { ReservationStatus } from "@brewspace/contracts";
import type { ReservationRepository, ReservationRecord } from "../repositories/reservation-repository";
import type { HoldRepository } from "../../availability";
import { generateReservationCode } from "./reservation-code-generator";
import { notFound, unauthorized } from "../../../shared/domain-error";
import { holdNotFound, seatUnavailable } from "../../availability/errors";
import { invalidTransition, cannotCancelCheckedIn, invalidReservationCode } from "../errors";

export class ReservationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly holdRepository: HoldRepository,
  ) {}

  async confirm(userId: string, holdToken: string, notes?: string): Promise<ReservationRecord> {
    const hold = await this.holdRepository.consume(holdToken);
    if (!hold) throw holdNotFound();
    if (hold.userId !== userId) throw unauthorized("This hold belongs to another customer.");

    return this.reservationRepository.create({
      userId,
      branchId: hold.branchId,
      seatId: hold.seatId,
      startAt: new Date(hold.startAt),
      endAt: new Date(hold.endAt),
      partySize: hold.partySize,
      reservationCode: generateReservationCode(),
      status: "CONFIRMED",
      notes,
    });
  }

  async get(reservationId: string, requester: { userId: string; role: string }): Promise<ReservationRecord> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    this.assertOwnerOrStaff(reservation, requester);
    return reservation;
  }

  async cancel(
    reservationId: string,
    requester: { userId: string; role: string },
    reason?: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    this.assertOwnerOrAdmin(reservation, requester);

    if (reservation.status === "CHECKED_IN") throw cannotCancelCheckedIn();
    this.assertTransition(reservation.status, "CANCELLED");

    return this.reservationRepository.updateStatus(reservationId, "CANCELLED", {
      cancelledAt: new Date(),
      cancellationReason: reason ?? null,
    });
  }

  async extend(
    reservationId: string,
    requester: { userId: string; role: string },
    newEndAt: Date,
  ): Promise<ReservationRecord> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    this.assertOwnerOrStaff(reservation, requester);

    if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) {
      throw invalidTransition(reservation.status, reservation.status);
    }
    if (newEndAt <= reservation.endAt) {
      throw seatUnavailable();
    }

    return this.reservationRepository.updateEndAt(reservationId, newEndAt);
  }

  async checkIn(userId: string, reservationCode: string): Promise<ReservationRecord> {
    const reservation = await this.reservationRepository.findByCode(reservationCode);
    if (!reservation) throw invalidReservationCode();
    if (reservation.userId !== userId) throw unauthorized("This reservation belongs to another customer.");

    this.assertTransition(reservation.status, "CHECKED_IN");
    return this.reservationRepository.updateStatus(reservation.id, "CHECKED_IN", {
      checkedInAt: new Date(),
    });
  }

  private assertTransition(from: ReservationStatus, to: ReservationStatus): void {
    if (!canTransition(RESERVATION_TRANSITIONS, from, to)) throw invalidTransition(from, to);
  }

  private assertOwnerOrStaff(reservation: ReservationRecord, requester: { userId: string; role: string }): void {
    const isOwner = reservation.userId === requester.userId;
    const isStaff = requester.role === "ADMIN" || requester.role === "WAITER";
    if (!isOwner && !isStaff) throw unauthorized();
  }

  private assertOwnerOrAdmin(reservation: ReservationRecord, requester: { userId: string; role: string }): void {
    const isOwner = reservation.userId === requester.userId;
    const isAdmin = requester.role === "ADMIN";
    if (!isOwner && !isAdmin) throw unauthorized();
  }
}
