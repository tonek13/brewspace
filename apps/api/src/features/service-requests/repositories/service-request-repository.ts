import type { ServiceRequestType, ServiceRequestStatus } from "@brewspace/contracts";

export interface ServiceRequestRecord {
  id: string;
  reservationId: string;
  customerId: string;
  assignedWaiterId: string | null;
  zoneId: string;
  type: ServiceRequestType;
  message: string | null;
  status: ServiceRequestStatus;
  createdAt: Date;
  acceptedAt: Date | null;
  completedAt: Date | null;
  rejectionReason: string | null;
}

export interface CreateServiceRequestInput {
  reservationId: string;
  customerId: string;
  zoneId: string;
  type: ServiceRequestType;
  message?: string;
}

export interface ServiceRequestRepository {
  findById(id: string): Promise<ServiceRequestRecord | null>;
  findByReservation(reservationId: string): Promise<ServiceRequestRecord[]>;
  findActiveBillRequest(reservationId: string): Promise<ServiceRequestRecord | null>;
  findForZones(zoneIds: string[], statuses: ServiceRequestStatus[]): Promise<ServiceRequestRecord[]>;
  findAllActive(): Promise<ServiceRequestRecord[]>;
  create(input: CreateServiceRequestInput): Promise<ServiceRequestRecord>;
  update(id: string, patch: Partial<ServiceRequestRecord>): Promise<ServiceRequestRecord>;
}
