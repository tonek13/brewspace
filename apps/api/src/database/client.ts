import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "test" ? 5 : 20,
  // Neon's pooled endpoint runs PgBouncer in transaction mode, which doesn't
  // support named prepared statements. Disabling them keeps postgres.js working
  // against the pooled connection string (and is harmless on a direct one).
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

export async function closeDatabase(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await queryClient`select 1`;
    return true;
  } catch {
    return false;
  }
}
