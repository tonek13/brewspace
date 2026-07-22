import { Elysia, t } from "elysia";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleSeatRepository } from "../seats";
import { DrizzleBranchRepository } from "../branches";
import { HoldRepository } from "./repositories/hold-repository";
import { AvailabilityService } from "./services/availability-service";
import { AvailabilityController } from "./controllers/availability-controller";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { availabilityQuerySchema, createHoldRequestSchema } from "@brewspace/contracts";

const seatRepository = new DrizzleSeatRepository(db);
const branchRepository = new DrizzleBranchRepository(db);
export const holdRepository = new HoldRepository(redis);
const availabilityService = new AvailabilityService(db, seatRepository, holdRepository);
const controller = new AvailabilityController(availabilityService, holdRepository, seatRepository, branchRepository);

export const availabilityRoutes = new Elysia({ prefix: "/api/v1" })
  .get("/branches/:branchId/availability", async ({ params, query, set }) => {
    try {
      const parsedQuery = availabilityQuerySchema.parse(query);
      return await controller.list(params.branchId, parsedQuery);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) })
  .post("/seats/:seatId/holds", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      const input = createHoldRequestSchema.parse(body);
      return await controller.createHold(params.seatId, auth.userId, input);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ seatId: t.String({ format: "uuid" }) }) })
  .delete("/seats/:seatId/holds", async ({ params, body, set }) => {
    try {
      const { token } = body as { token: string };
      return await controller.releaseHold(params.seatId, token);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ seatId: t.String({ format: "uuid" }) }) });
