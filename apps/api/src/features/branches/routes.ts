import { Elysia, t } from "elysia";
import { db } from "../../database/client";
import { DrizzleBranchRepository } from "./repositories/drizzle-branch-repository";
import { BranchController } from "./controllers/branch-controller";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { AdminBranchController } from "./controllers/admin-branch-controller";

const repository = new DrizzleBranchRepository(db);
const controller = new BranchController(repository);
const adminController = new AdminBranchController(repository);

export const branchRoutes = new Elysia({ prefix: "/api/v1/branches" })
  .get("/", async ({ set }) => {
    try {
      return await controller.list();
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .get("/:branchId", async ({ params, set }) => {
    try {
      return await controller.getById(params.branchId);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) })
  .get("/:branchId/opening-hours", async ({ params, set }) => {
    try {
      return await controller.getOpeningHours(params.branchId);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) });

export const adminBranchRoutes = new Elysia({ prefix: "/api/v1/admin/branches" })
  .post("/", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      set.status = 201;
      return await adminController.create(body);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/:branchId", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      return await adminController.update(params.branchId, body);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) });
