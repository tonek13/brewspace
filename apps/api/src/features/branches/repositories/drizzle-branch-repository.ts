import { eq } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { branches, openingHours } from "../../../database/schema";
import type { BranchRepository, BranchRecord } from "./branch-repository";

export class DrizzleBranchRepository implements BranchRepository {
  constructor(private readonly db: Database) {}

  async findActive(): Promise<BranchRecord[]> {
    return this.db.select().from(branches).where(eq(branches.active, true));
  }

  async findById(id: string): Promise<BranchRecord | null> {
    const [row] = await this.db.select().from(branches).where(eq(branches.id, id)).limit(1);
    return row ?? null;
  }

  async findOpeningHours(branchId: string) {
    return this.db.select().from(openingHours).where(eq(openingHours.branchId, branchId));
  }

  async create(input: Omit<BranchRecord, "id" | "createdAt" | "updatedAt">): Promise<BranchRecord> {
    const [row] = await this.db.insert(branches).values(input).returning();
    if (!row) throw new Error("Failed to create branch");
    return row;
  }

  async update(id: string, input: Partial<Omit<BranchRecord, "id" | "createdAt" | "updatedAt">>): Promise<BranchRecord> {
    const [row] = await this.db
      .update(branches)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    if (!row) throw new Error("Branch not found");
    return row;
  }
}
