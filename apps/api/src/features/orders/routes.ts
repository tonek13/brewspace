import { Elysia, t } from "elysia";
import { z } from "zod";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleOrderRepository } from "./repositories/drizzle-order-repository";
import { DrizzleReservationRepository } from "../reservations";
import { DrizzleMenuRepository } from "../menu";
import { EventPublisher } from "../service-requests";
import { OrderService } from "./services/order-service";
import { serializeOrder } from "./serializers/order-serializer";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";

const orderRepository = new DrizzleOrderRepository(db);
const reservationRepository = new DrizzleReservationRepository(db);
const menuRepository = new DrizzleMenuRepository(db);
const eventPublisher = new EventPublisher(redis);
const service = new OrderService(orderRepository, reservationRepository, menuRepository, eventPublisher);

const submitOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().max(300).optional(),
        optionValueIds: z.array(z.string().uuid()).max(20).optional(),
      }),
    )
    .min(1)
    .max(50),
  notes: z.string().max(500).optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export const orderRoutes = new Elysia({ prefix: "/api/v1" })
  .post("/reservations/:reservationId/orders", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = submitOrderSchema.parse(body);
      const order = await service.submit(params.reservationId, auth.userId, input.items, input.notes);
      set.status = 201;
      return { success: true as const, data: serializeOrder(order) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .get("/orders/:orderId", async ({ params, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const order = await service.get(params.orderId, auth);
      return { success: true as const, data: serializeOrder(order) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ orderId: t.String({ format: "uuid" }) }) })
  .get("/staff/orders", async ({ cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "WAITER", "ADMIN");
      const orders = await service.listActiveForStaff();
      return { success: true as const, data: orders.map(serializeOrder) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/staff/orders/:orderId/status", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "WAITER", "ADMIN");
      const input = updateOrderStatusSchema.parse(body);
      const order = await service.updateStatus(params.orderId, input.status);
      return { success: true as const, data: serializeOrder(order) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ orderId: t.String({ format: "uuid" }) }) });
