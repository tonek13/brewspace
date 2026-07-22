import { SERVICE_REQUEST_TRANSITIONS, canTransition } from "@brewspace/contracts";
import type { ServiceRequestType, ServiceRequestStatus } from "@brewspace/contracts";
import type { ServiceRequestRepository, ServiceRequestRecord } from "../repositories/service-request-repository";
import type { ReservationRepository } from "../../reservations";
import type { SeatRepository } from "../../seats";
import type { StaffZoneService } from "./staff-zone-service";
import type { EventPublisher } from "./event-publisher";
import { notFound, unauthorized } from "../../../shared/domain-error";
import { notCheckedIn, duplicateBillRequest, invalidRequestTransition, outsideAssignedZones } from "../errors";

export class ServiceRequestService {
  constructor(
    private readonly requestRepository: ServiceRequestRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly seatRepository: SeatRepository,
    private readonly staffZoneService: StaffZoneService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async create(
    reservationId: string,
    customerId: string,
    type: ServiceRequestType,
    message?: string,
  ): Promise<ServiceRequestRecord> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    if (reservation.userId !== customerId) throw unauthorized();
    if (reservation.status !== "CHECKED_IN") throw notCheckedIn();

    if (type === "REQUEST_BILL") {
      const active = await this.requestRepository.findActiveBillRequest(reservationId);
      if (active) throw duplicateBillRequest();
    }

    const seat = await this.seatRepository.findById(reservation.seatId);
    if (!seat) throw notFound("Seat");

    const created = await this.requestRepository.create({
      reservationId,
      customerId,
      zoneId: seat.zoneId,
      type,
      message,
    });
    await this.eventPublisher.publish(reservation.branchId, {
      kind: "service-request.created",
      requestId: created.id,
      zoneId: created.zoneId,
      type: created.type,
    });
    return created;
  }

  async listForReservation(reservationId: string, requesterId: string, role: string): Promise<ServiceRequestRecord[]> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    const isOwner = reservation.userId === requesterId;
    const isStaff = role === "ADMIN" || role === "WAITER";
    if (!isOwner && !isStaff) throw unauthorized();
    return this.requestRepository.findByReservation(reservationId);
  }

  async listForStaff(waiterId: string, role: string): Promise<ServiceRequestRecord[]> {
    if (role === "ADMIN") {
      return this.requestRepository.findAllActive();
    }
    const activeStatuses: ServiceRequestStatus[] = ["PENDING", "ACCEPTED", "IN_PROGRESS"];
    const zoneIds = await this.staffZoneService.assignedZoneIds(waiterId);
    return this.requestRepository.findForZones(zoneIds, activeStatuses);
  }

  async updateStatus(
    requestId: string,
    staff: { userId: string; role: string },
    target: ServiceRequestStatus,
    rejectionReason?: string,
  ): Promise<ServiceRequestRecord> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw notFound("Service request");

    if (staff.role !== "ADMIN") {
      const zoneIds = await this.staffZoneService.assignedZoneIds(staff.userId);
      if (!zoneIds.includes(request.zoneId)) throw outsideAssignedZones();
    }

    if (!canTransition(SERVICE_REQUEST_TRANSITIONS, request.status, target)) {
      throw invalidRequestTransition(request.status, target);
    }

    const patch: Partial<ServiceRequestRecord> = { status: target };
    if (target === "ACCEPTED") {
      patch.assignedWaiterId = staff.userId;
      patch.acceptedAt = new Date();
    }
    if (target === "COMPLETED") patch.completedAt = new Date();
    if (target === "REJECTED") patch.rejectionReason = rejectionReason ?? null;

    const updated = await this.requestRepository.update(requestId, patch);

    const reservation = await this.reservationRepository.findById(request.reservationId);
    if (reservation) {
      await this.eventPublisher.publish(reservation.branchId, {
        kind: "service-request.updated",
        requestId: updated.id,
        zoneId: updated.zoneId,
        status: updated.status,
      });
    }
    return updated;
  }

}
