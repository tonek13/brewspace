import type { UserRecord } from "../types";
import type { UserRole } from "@brewspace/contracts";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

/**
 * Narrow persistence boundary for the User aggregate. Services and controllers
 * depend only on this interface. The Drizzle-backed implementation below is a
 * swappable detail — kept isolated because Liquid ORM was unavailable at
 * implementation time (see project README, "ORM decision").
 */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
