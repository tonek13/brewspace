import { Elysia, t } from "elysia";
import { z } from "zod";
import { db } from "../../database/client";
import { DrizzleSeatRepository } from "./repositories/drizzle-seat-repository";
import { serializeSeat } from "./serializers/seat-serializer";
import { toErrorResponse } from "../../shared/http-response";
import { notFound } from "../../shared/domain-error";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { SEAT_TYPES, SEAT_STATUSES } from "@brewspace/contracts";

const repository = new DrizzleSeatRepository(db);

const seatBodySchema = z.object({
  branchId: z.string().uuid(),
  zoneId: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(SEAT_TYPES),
  capacity: z.number().int().min(1).max(50),
  status: z.enum(SEAT_STATUSES).default("AVAILABLE"),
  description: z.string().max(500).nullable().default(null),
  reservable: z.boolean().default(true),
  hourlyPriceCents: z.number().int().min(0).nullable().default(null),
  nearWindow: z.boolean().default(false),
  hasPowerOutlet: z.boolean().default(false),
  quietArea: z.boolean().default(false),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  positionZ: z.number().default(0),
  rotationX: z.number().default(0),
  rotationY: z.number().default(0),
  rotationZ: z.number().default(0),
  scaleX: z.number().positive().default(1),
  scaleY: z.number().positive().default(1),
  scaleZ: z.number().positive().default(1),
});
const seatPatchSchema = seatBodySchema.omit({ branchId: true }).partial();

const floorMapPatchSchema = z.object({
  seats: z
    .array(
      z.object({
        seatId: z.string().uuid(),
        positionX: z.number(),
        positionY: z.number(),
        positionZ: z.number(),
        rotationX: z.number(),
        rotationY: z.number(),
        rotationZ: z.number(),
        scaleX: z.number().positive(),
        scaleY: z.number().positive(),
        scaleZ: z.number().positive(),
      }),
    )
    .min(1)
    .max(500),
});

export const seatRoutes = new Elysia({ prefix: "/api/v1" })
  .get("/branches/:branchId/seats", async ({ params, set }) => {
    try {
      const seats = await repository.findByBranch(params.branchId);
      return { success: true as const, data: seats.map(serializeSeat) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) })
  .get("/branches/:branchId/floor-map", async ({ params, set }) => {
    try {
      const seats = await repository.findByBranch(params.branchId);
      return { success: true as const, data: { seats: seats.map(serializeSeat) } };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) })
  .get("/seats/:seatId", async ({ params, set }) => {
    try {
      const seat = await repository.findById(params.seatId);
      if (!seat) throw notFound("Seat");
      return { success: true as const, data: serializeSeat(seat) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ seatId: t.String({ format: "uuid" }) }) })
  .post("/admin/seats", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = seatBodySchema.parse(body);
      const seat = await repository.create(input);
      set.status = 201;
      return { success: true as const, data: serializeSeat(seat) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/admin/seats/:seatId", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const existing = await repository.findById(params.seatId);
      if (!existing) throw notFound("Seat");
      const input = seatPatchSchema.parse(body);
      const seat = await repository.update(params.seatId, input);
      return { success: true as const, data: serializeSeat(seat) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ seatId: t.String({ format: "uuid" }) }) })
  .patch("/admin/branches/:branchId/floor-map", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = floorMapPatchSchema.parse(body);
      const updated = [];
      for (const entry of input.seats) {
        const seat = await repository.findById(entry.seatId);
        if (!seat || seat.branchId !== params.branchId) throw notFound("Seat");
        const { seatId, ...transform } = entry;
        updated.push(await repository.update(seatId, transform));
      }
      return { success: true as const, data: updated.map(serializeSeat) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) });
