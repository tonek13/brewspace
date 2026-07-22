import { Elysia, t } from "elysia";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleServiceRequestRepository } from "./repositories/drizzle-service-request-repository";
import { DrizzleReservationRepository } from "../reservations";
import { DrizzleSeatRepository } from "../seats";
import { StaffZoneService } from "./services/staff-zone-service";
import { EventPublisher } from "./services/event-publisher";
import { ServiceRequestService } from "./services/service-request-service";
import { serializeServiceRequest } from "./serializers/service-request-serializer";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { createServiceRequestSchema, updateServiceRequestStatusSchema } from "@brewspace/contracts";

const requestRepository = new DrizzleServiceRequestRepository(db);
const reservationRepository = new DrizzleReservationRepository(db);
const seatRepository = new DrizzleSeatRepository(db);
const staffZoneService = new StaffZoneService(db);
const eventPublisher = new EventPublisher(redis);
const service = new ServiceRequestService(
  requestRepository,
  reservationRepository,
  seatRepository,
  staffZoneService,
  eventPublisher,
);

export const serviceRequestRoutes = new Elysia({ prefix: "/api/v1" })
  .post("/reservations/:reservationId/service-requests", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = createServiceRequestSchema.parse(body);
      const created = await service.create(params.reservationId, auth.userId, input.type, input.message);
      set.status = 201;
      return { success: true as const, data: serializeServiceRequest(created) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .get("/reservations/:reservationId/service-requests", async ({ params, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const requests = await service.listForReservation(params.reservationId, auth.userId, auth.role);
      return { success: true as const, data: requests.map(serializeServiceRequest) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ reservationId: t.String({ format: "uuid" }) }) })
  .get("/staff/service-requests", async ({ cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "WAITER", "ADMIN");
      const requests = await service.listForStaff(auth.userId, auth.role);
      return { success: true as const, data: requests.map(serializeServiceRequest) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/staff/service-requests/:requestId/status", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "WAITER", "ADMIN");
      const input = updateServiceRequestStatusSchema.parse(body);
      const updated = await service.updateStatus(params.requestId, auth, input.status, input.rejectionReason);
      return { success: true as const, data: serializeServiceRequest(updated) };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ requestId: t.String({ format: "uuid" }) }) });
