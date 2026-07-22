import type { UserRole, UserStatus } from "@brewspace/contracts";

export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  userId: string;
  role: UserRole;
}
