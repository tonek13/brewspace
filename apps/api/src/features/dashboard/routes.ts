import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import Redis from "ioredis";
import { db } from "../../database/client";
import { env } from "../../config/env";
import { redisKeys } from "../../infrastructure/redis";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";

export const dashboardRoutes = new Elysia({ prefix: "/api/v1" })
  .get("/admin/dashboard", async ({ cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");

      const [stats] = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM reservations WHERE status IN ('CONFIRMED','CHECKED_IN')) AS active_reservations,
          (SELECT count(*) FROM reservations WHERE status = 'CHECKED_IN') AS active_check_ins,
          (SELECT count(*) FROM service_requests WHERE status IN ('PENDING','ACCEPTED','IN_PROGRESS')) AS open_requests,
          (SELECT coalesce(sum(total_cents), 0) FROM orders WHERE status = 'SERVED' AND created_at >= date_trunc('day', now())) AS daily_sales_cents
      `);

      const popularSeats = await db.execute(sql`
        SELECT s.id, s.name, count(r.id)::int AS reservation_count
        FROM seats s JOIN reservations r ON r.seat_id = s.id
        GROUP BY s.id, s.name ORDER BY reservation_count DESC LIMIT 5
      `);

      const popularItems = await db.execute(sql`
        SELECT m.id, m.name, coalesce(sum(oi.quantity), 0)::int AS ordered_quantity
        FROM menu_items m JOIN order_items oi ON oi.menu_item_id = m.id
        GROUP BY m.id, m.name ORDER BY ordered_quantity DESC LIMIT 5
      `);

      const waiterResponse = await db.execute(sql`
        SELECT assigned_waiter_id, avg(extract(epoch FROM (accepted_at - created_at)))::int AS avg_response_seconds
        FROM service_requests
        WHERE accepted_at IS NOT NULL AND assigned_waiter_id IS NOT NULL
        GROUP BY assigned_waiter_id
      `);

      return {
        success: true as const,
        data: {
          summary: stats,
          popularSeats,
          popularItems,
          waiterResponseTimes: waiterResponse,
        },
      };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .get("/events", async ({ query, cookie, request, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "WAITER", "ADMIN");
      const branchId = typeof query.branchId === "string" ? query.branchId : null;
      if (!branchId) {
        set.status = 400;
        return {
          success: false as const,
          error: { code: "VALIDATION_ERROR" as const, message: "branchId is required.", fieldErrors: [] },
        };
      }

      // Each SSE connection gets its own subscriber connection; a Redis client
      // in subscribe mode cannot run regular commands, so the shared client
      // is not reused here.
      const subscriber = new Redis(env.REDIS_URL);
      await subscriber.subscribe(redisKeys.events(branchId));

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`retry: 3000\n\n`));

          subscriber.on("message", (_channel, message) => {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          });

          const heartbeat = setInterval(() => {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }, 25_000);

          request.signal.addEventListener("abort", () => {
            clearInterval(heartbeat);
            subscriber.disconnect();
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    } catch (error) {
      return toErrorResponse(error, set);
    }
  });
