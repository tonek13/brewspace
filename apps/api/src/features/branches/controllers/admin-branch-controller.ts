import { z } from "zod";
import type { BranchRepository } from "../repositories/branch-repository";
import { serializeBranch } from "../serializers/branch-serializer";
import { notFound } from "../../../shared/domain-error";

export const branchBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().default(null),
  address: z.string().min(1),
  timezone: z.string().min(1),
  phone: z.string().max(32).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  active: z.boolean().default(true),
});
export const branchPatchSchema = branchBodySchema.partial();

export class AdminBranchController {
  constructor(private readonly repository: BranchRepository) {}

  async create(body: unknown) {
    const input = branchBodySchema.parse(body);
    const branch = await this.repository.create(input);
    return { success: true as const, data: serializeBranch(branch) };
  }

  async update(branchId: string, body: unknown) {
    const existing = await this.repository.findById(branchId);
    if (!existing) throw notFound("Branch");
    const input = branchPatchSchema.parse(body);
    const branch = await this.repository.update(branchId, input);
    return { success: true as const, data: serializeBranch(branch) };
  }
}
