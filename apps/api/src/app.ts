import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { randomUUID } from "node:crypto";
import { env } from "./config/env";
import { checkDatabaseHealth, closeDatabase } from "./database/client";
import { checkRedisHealth, redis } from "./infrastructure/redis";
import { authRoutes } from "./features/authentication";
import { branchRoutes, adminBranchRoutes } from "./features/branches";
import { availabilityRoutes } from "./features/availability";
import { reservationRoutes } from "./features/reservations";
import { seatRoutes } from "./features/seats";
import { zoneRoutes } from "./features/zones";
import { serviceRequestRoutes } from "./features/service-requests";
import { menuRoutes } from "./features/menu";
import { orderRoutes } from "./features/orders";
import { dashboardRoutes } from "./features/dashboard";

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "BrewSpace API",
          version: "1.0.0",
          description:
            "Coffee-shop workspace, table and desk reservation platform. " +
            "Import the machine-readable spec from /docs/json into APIDog, Postman, or Insomnia.",
        },
        tags: [
          { name: "auth", description: "Registration, login, session." },
          { name: "branches", description: "Cafés, opening hours, floor map." },
          { name: "availability", description: "Seat availability and holds." },
          { name: "reservations", description: "Confirm, cancel, extend, check in." },
          { name: "service-requests", description: "Customer requests and staff queue." },
          { name: "menu", description: "Menu browsing and admin management." },
          { name: "orders", description: "Table orders and kitchen pipeline." },
          { name: "admin", description: "Dashboard metrics and configuration." },
        ],
      },
    }),
  )
  .onRequest(({ set, request }) => {
    set.headers["x-correlation-id"] = request.headers.get("x-correlation-id") ?? randomUUID();
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["x-frame-options"] = "DENY";
    set.headers["referrer-policy"] = "strict-origin-when-cross-origin";
  })
  .get("/health", () => ({ status: "ok" }))
  .get("/ready", async ({ set }) => {
    const [databaseHealthy, redisHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    const ready = databaseHealthy && redisHealthy;
    set.status = ready ? 200 : 503;
    return { status: ready ? "ready" : "not-ready", database: databaseHealthy, redis: redisHealthy };
  })
  .use(authRoutes)
  .use(branchRoutes)
  .use(adminBranchRoutes)
  .use(seatRoutes)
  .use(zoneRoutes)
  .use(availabilityRoutes)
  .use(reservationRoutes)
  .use(serviceRequestRoutes)
  .use(menuRoutes)
  .use(orderRoutes)
  .use(dashboardRoutes);

if (import.meta.main) {
  app.listen(env.PORT);
  console.log(JSON.stringify({ level: "info", message: `BrewSpace API listening on port ${env.PORT}` }));

  const shutdown = async () => {
    console.log(JSON.stringify({ level: "info", message: "Shutting down gracefully" }));
    await closeDatabase();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
