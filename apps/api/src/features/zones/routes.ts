import { Elysia, t } from "elysia";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { zones } from "../../database/schema";
import { toErrorResponse } from "../../shared/http-response";
import { notFound } from "../../shared/domain-error";
import { requireAuth, requireRole } from "../../shared/auth-middleware";
import { readSessionCookie } from "../../shared/cookie-jar";
import { ZONE_TYPES } from "@brewspace/contracts";

const zoneBodySchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().default(null),
  type: z.enum(ZONE_TYPES),
  floorNumber: z.number().int().default(0),
  active: z.boolean().default(true),
});
const zonePatchSchema = zoneBodySchema.omit({ branchId: true }).partial();

export const zoneRoutes = new Elysia({ prefix: "/api/v1/admin/zones" })
  .post("/", async ({ body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = zoneBodySchema.parse(body);
      const [zone] = await db.insert(zones).values(input).returning();
      set.status = 201;
      return { success: true as const, data: zone };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .patch("/:zoneId", async ({ params, body, cookie, set }) => {
    try {
      const auth = await requireAuth(readSessionCookie(cookie, "brewspace_session"));
      requireRole(auth, "ADMIN");
      const input = zonePatchSchema.parse(body);
      const [zone] = await db.update(zones).set(input).where(eq(zones.id, params.zoneId)).returning();
      if (!zone) throw notFound("Zone");
      return { success: true as const, data: zone };
    } catch (error) {
      return toErrorResponse(error, set);
    }
  }, { params: t.Object({ zoneId: t.String({ format: "uuid" }) }) });
