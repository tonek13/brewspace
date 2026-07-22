import type { ServiceRequestRecord } from "../repositories/service-request-repository";
import type { ServiceRequestDto } from "@brewspace/contracts";

export function serializeServiceRequest(request: ServiceRequestRecord): ServiceRequestDto {
  return {
    id: request.id,
    reservationId: request.reservationId,
    customerId: request.customerId,
    assignedWaiterId: request.assignedWaiterId,
    zoneId: request.zoneId,
    type: request.type,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    acceptedAt: request.acceptedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
  };
}
