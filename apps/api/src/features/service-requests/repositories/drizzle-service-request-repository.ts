import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { serviceRequests } from "../../../database/schema";
import type {
  ServiceRequestRepository,
  ServiceRequestRecord,
  CreateServiceRequestInput,
} from "./service-request-repository";
import type { ServiceRequestStatus } from "@brewspace/contracts";

const ACTIVE_STATUSES: ServiceRequestStatus[] = ["PENDING", "ACCEPTED", "IN_PROGRESS"];

export class DrizzleServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ServiceRequestRecord | null> {
    const [row] = await this.db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
    return row ?? null;
  }

  async findByReservation(reservationId: string): Promise<ServiceRequestRecord[]> {
    return this.db.select().from(serviceRequests).where(eq(serviceRequests.reservationId, reservationId));
  }

  async findActiveBillRequest(reservationId: string): Promise<ServiceRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.reservationId, reservationId),
          eq(serviceRequests.type, "REQUEST_BILL"),
          inArray(serviceRequests.status, ACTIVE_STATUSES),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findForZones(zoneIds: string[], statuses: ServiceRequestStatus[]): Promise<ServiceRequestRecord[]> {
    if (zoneIds.length === 0) return [];
    return this.db
      .select()
      .from(serviceRequests)
      .where(and(inArray(serviceRequests.zoneId, zoneIds), inArray(serviceRequests.status, statuses)));
  }

  async findAllActive(): Promise<ServiceRequestRecord[]> {
    return this.db
      .select()
      .from(serviceRequests)
      .where(inArray(serviceRequests.status, ACTIVE_STATUSES));
  }

  async create(input: CreateServiceRequestInput): Promise<ServiceRequestRecord> {
    const [row] = await this.db.insert(serviceRequests).values(input).returning();
    if (!row) throw new Error("Failed to create service request");
    return row;
  }

  async update(id: string, patch: Partial<ServiceRequestRecord>): Promise<ServiceRequestRecord> {
    const [row] = await this.db
      .update(serviceRequests)
      .set(patch)
      .where(eq(serviceRequests.id, id))
      .returning();
    if (!row) throw new Error("Service request not found");
    return row;
  }
}
