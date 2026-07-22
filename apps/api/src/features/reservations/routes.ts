import { Elysia, t } from "elysia";
import { db } from "../../database/client";
import { holdRepository } from "../availability";
import { DrizzleReservationRepository } from "./repositories/drizzle-reservation-repository";
import { ReservationService } from "./services/reservation-service";
import { ReservationController } from "./controllers/reservation-controller";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import {
  createReservationRequestSchema,
  cancelReservationRequestSchema,
  extendReservationRequestSchema,
  checkInRequestSchema,
  paginationQuerySchema,
} from "@brewspace/contracts";

const reservationRepository = new DrizzleReservationRepository(db);
const reservationService = new ReservationService(reservationRepository, holdRepository);
const controller = new ReservationController(reservationService, reservationRepository);

export const reservationRoutes = new Elysia({ prefix: "/api/v1/reservations" })
  .post("/", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = createReservationRequestSchema.parse(body);
      set.status = 201;
      return await controller.confirm(auth.userId, input);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .get("/", async ({ query, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const { page, pageSize } = paginationQuerySchema.parse(query);
      return await controller.list(auth.userId, page, pageSize);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .get("/:reservationId", async ({ params, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      return await controller.getById(params.reservationId, auth);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .post("/:reservationId/cancellations", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = cancelReservationRequestSchema.parse(body ?? {});
      return await controller.cancel(params.reservationId, auth, input);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .post("/:reservationId/extensions", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = extendReservationRequestSchema.parse(body);
      return await controller.extend(params.reservationId, auth, input);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .post("/:reservationId/check-ins", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = checkInRequestSchema.parse(body);
      return await controller.checkIn(auth.userId, input);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) });
