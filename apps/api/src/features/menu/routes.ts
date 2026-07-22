import { Elysia, t } from "elysia";
import { z } from "zod";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleMenuRepository } from "./repositories/drizzle-menu-repository";
import { MenuService } from "./services/menu-service";
import { toErrorResponse } from "../../shared/http-response";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { notFound } from "../../shared/domain-error";

const menuRepository = new DrizzleMenuRepository(db);
export const menuService = new MenuService(menuRepository, redis);

const createCategorySchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().default(null),
  displayOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
const updateCategorySchema = createCategorySchema.omit({ branchId: true }).partial();

const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().default(null),
  priceCents: z.number().int().min(0),
  imageUrl: z.string().url().nullable().default(null),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});
const updateItemSchema = createItemSchema.omit({ categoryId: true }).partial();

async function invalidateForCategory(categoryId: string): Promise<void> {
  const category = await menuRepository.findCategoryById(categoryId);
  if (category) await menuService.invalidateBranchMenu(category.branchId);
}

export const menuRoutes = new Elysia({ prefix: "/api/v1" })
  .get("/branches/:branchId/menu", async ({ params, set }) => {
    try {
      const menu = await menuService.getBranchMenu(params.branchId);
      return { success: true as const, data: menu };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ branchId: t.String({ format: "uuid" }) }) })
  .post("/admin/menu-categories", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = createCategorySchema.parse(body);
      const created = await menuRepository.createCategory(input);
      await menuService.invalidateBranchMenu(input.branchId);
      set.status = 201;
      return { success: true as const, data: created };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/admin/menu-categories/:categoryId", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const existing = await menuRepository.findCategoryById(params.categoryId);
      if (!existing) throw notFound("Menu category");
      const input = updateCategorySchema.parse(body);
      const updated = await menuRepository.updateCategory(params.categoryId, input);
      await menuService.invalidateBranchMenu(updated.branchId);
      return { success: true as const, data: updated };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ categoryId: t.String({ format: "uuid" }) }) })
  .post("/admin/menu-items", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = createItemSchema.parse(body);
      const category = await menuRepository.findCategoryById(input.categoryId);
      if (!category) throw notFound("Menu category");
      const created = await menuRepository.createItem(input);
      await menuService.invalidateBranchMenu(category.branchId);
      set.status = 201;
      return { success: true as const, data: created };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/admin/menu-items/:menuItemId", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const existing = await menuRepository.findItemById(params.menuItemId);
      if (!existing) throw notFound("Menu item");
      const input = updateItemSchema.parse(body);
      const updated = await menuRepository.updateItem(params.menuItemId, input);
      await invalidateForCategory(updated.categoryId);
      return { success: true as const, data: updated };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ menuItemId: t.String({ format: "uuid" }) }) });
