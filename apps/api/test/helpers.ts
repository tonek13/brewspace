import { app } from "../src/app";
import { db } from "../src/database/client";
import { redis } from "../src/infrastructure/redis";
import { sql } from "drizzle-orm";

export async function resetState(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      order_item_options, order_items, orders,
      service_requests, reservations,
      staff_zone_assignments, seats, zones,
      menu_item_option_values, menu_item_options, menu_items, menu_categories,
      opening_hours, branches, users
    RESTART IDENTITY CASCADE
  `);
  await redis.flushdb();
}

export interface TestResponse {
  status: number;
  body: Record<string, unknown>;
  cookies: string[];
}

export async function request(
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string } = {},
): Promise<TestResponse> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers["cookie"] = options.cookie;

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }),
  );

  const cookies = response.headers.getSetCookie?.() ?? [];
  let body: Record<string, unknown> = {};
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: response.status, body, cookies };
}

export function sessionCookieFrom(response: TestResponse): string {
  const setCookie = response.cookies.find((cookie) => cookie.startsWith("brewspace_session="));
  if (!setCookie) throw new Error("No session cookie in response");
  return setCookie.split(";")[0] ?? "";
}

export async function registerAndLogin(overrides: { email?: string } = {}): Promise<{ cookie: string; userId: string }> {
  const email = overrides.email ?? `flow-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const response = await request("POST", "/api/v1/auth/register", {
    body: { firstName: "Flow", lastName: "Tester", email, password: "a-strong-password" },
  });
  if (response.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(response.body)}`);
  const data = response.body.data as { id: string };
  return { cookie: sessionCookieFrom(response), userId: data.id };
}

export async function loginAs(email: string, password: string): Promise<string> {
  const response = await request("POST", "/api/v1/auth/login", { body: { email, password } });
  if (response.status !== 200) throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
  return sessionCookieFrom(response);
}
