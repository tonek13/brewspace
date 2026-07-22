import { sessionService } from "../features/authentication";
import { unauthenticated, unauthorized } from "./domain-error";
import type { AuthContext } from "../features/authentication";
import type { UserRole } from "@brewspace/contracts";

export async function requireAuth(sessionCookieValue: string | undefined): Promise<AuthContext> {
  if (!sessionCookieValue) throw unauthenticated();
  const context = await sessionService.resolve(sessionCookieValue);
  if (!context) throw unauthenticated();
  return context;
}

export function requireRole(context: AuthContext, ...roles: UserRole[]): void {
  if (!roles.includes(context.role)) throw unauthorized();
}
