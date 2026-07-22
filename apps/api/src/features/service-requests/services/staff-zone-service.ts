import { and, eq } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { staffZoneAssignments } from "../../../database/schema";

export class StaffZoneService {
  constructor(private readonly db: Database) {}

  async assignedZoneIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ zoneId: staffZoneAssignments.zoneId })
      .from(staffZoneAssignments)
      .where(and(eq(staffZoneAssignments.userId, userId), eq(staffZoneAssignments.active, true)));
    return rows.map((row) => row.zoneId);
  }
}
