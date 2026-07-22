import { eq, sql } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { users } from "../../../database/schema";
import type { UserRepository, CreateUserInput } from "./user-repository";
import type { UserRecord } from "../types";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({ ...input, status: "ACTIVE" })
      .returning();
    if (!row) throw new Error("Failed to create user");
    return row;
  }
}
