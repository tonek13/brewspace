import { and, eq, count } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { reservations } from "../../../database/schema";
import type {
  ReservationRepository,
  ReservationRecord,
  CreateReservationInput,
  ReservationListFilter,
} from "./reservation-repository";
import { RESERVATION_OVERLAP_SQLSTATE } from "./reservation-repository";
import type { ReservationStatus } from "@brewspace/contracts";
import { seatUnavailable } from "../../availability/errors";

interface PostgresDriverError {
  code?: string;
}

export class DrizzleReservationRepository implements ReservationRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ReservationRecord | null> {
    const [row] = await this.db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    return row ?? null;
  }

  async findByCode(code: string): Promise<ReservationRecord | null> {
    const [row] = await this.db
      .select()
      .from(reservations)
      .where(eq(reservations.reservationCode, code))
      .limit(1);
    return row ?? null;
  }

  async findMany(
    filter: ReservationListFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: ReservationRecord[]; total: number }> {
    const conditions = [];
    if (filter.userId) conditions.push(eq(reservations.userId, filter.userId));
    if (filter.status) conditions.push(eq(reservations.status, filter.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(reservations)
        .where(where)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(reservations).where(where),
    ]);

    return { items, total: totalRows[0]?.value ?? 0 };
  }

  async create(input: CreateReservationInput): Promise<ReservationRecord> {
    try {
      const [row] = await this.db
        .insert(reservations)
        .values(input)
        .returning();
      if (!row) throw new Error("Failed to create reservation");
      return row;
    } catch (error) {
      if ((error as PostgresDriverError)?.code === RESERVATION_OVERLAP_SQLSTATE) {
        throw seatUnavailable();
      }
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
    extra: Partial<ReservationRecord> = {},
  ): Promise<ReservationRecord> {
    try {
      const [row] = await this.db
        .update(reservations)
        .set({ status, ...extra, updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();
      if (!row) throw new Error("Reservation not found");
      return row;
    } catch (error) {
      if ((error as PostgresDriverError)?.code === RESERVATION_OVERLAP_SQLSTATE) {
        throw seatUnavailable();
      }
      throw error;
    }
  }

  async updateEndAt(id: string, endAt: Date): Promise<ReservationRecord> {
    try {
      const [row] = await this.db
        .update(reservations)
        .set({ endAt, updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();
      if (!row) throw new Error("Reservation not found");
      return row;
    } catch (error) {
      if ((error as PostgresDriverError)?.code === RESERVATION_OVERLAP_SQLSTATE) {
        throw seatUnavailable();
      }
      throw error;
    }
  }
}
