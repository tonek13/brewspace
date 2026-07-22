import { and, eq, gte } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { seats } from "../../../database/schema";
import type { SeatRepository, SeatRecord, SeatFilter } from "./seat-repository";

export class DrizzleSeatRepository implements SeatRepository {
  constructor(private readonly db: Database) {}

  async findByBranch(branchId: string, filter: SeatFilter = {}): Promise<SeatRecord[]> {
    const conditions = [eq(seats.branchId, branchId), eq(seats.reservable, true)];
    if (filter.seatType) conditions.push(eq(seats.type, filter.seatType));
    if (filter.zoneId) conditions.push(eq(seats.zoneId, filter.zoneId));
    if (filter.nearWindow) conditions.push(eq(seats.nearWindow, true));
    if (filter.hasPowerOutlet) conditions.push(eq(seats.hasPowerOutlet, true));
    if (filter.quietArea) conditions.push(eq(seats.quietArea, true));
    if (filter.minCapacity) conditions.push(gte(seats.capacity, filter.minCapacity));

    return this.db.select().from(seats).where(and(...conditions));
  }

  async findById(id: string): Promise<SeatRecord | null> {
    const [row] = await this.db.select().from(seats).where(eq(seats.id, id)).limit(1);
    return row ?? null;
  }

  async create(input: Omit<SeatRecord, "id" | "createdAt" | "updatedAt">): Promise<SeatRecord> {
    const [row] = await this.db.insert(seats).values(input).returning();
    if (!row) throw new Error("Failed to create seat");
    return row;
  }

  async update(id: string, input: Partial<Omit<SeatRecord, "id" | "createdAt" | "updatedAt">>): Promise<SeatRecord> {
    const [row] = await this.db
      .update(seats)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(seats.id, id))
      .returning();
    if (!row) throw new Error("Seat not found");
    return row;
  }
}
