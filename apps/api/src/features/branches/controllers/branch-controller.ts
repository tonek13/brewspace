import type { BranchRepository } from "../repositories/branch-repository";
import { serializeBranch, serializeOpeningHour } from "../serializers/branch-serializer";
import { notFound } from "../../../shared/domain-error";

export class BranchController {
  constructor(private readonly repository: BranchRepository) {}

  async list() {
    const branches = await this.repository.findActive();
    return { success: true as const, data: branches.map(serializeBranch) };
  }

  async getById(branchId: string) {
    const branch = await this.repository.findById(branchId);
    if (!branch) throw notFound("Branch");
    return { success: true as const, data: serializeBranch(branch) };
  }

  async getOpeningHours(branchId: string) {
    const branch = await this.repository.findById(branchId);
    if (!branch) throw notFound("Branch");
    const hours = await this.repository.findOpeningHours(branchId);
    return { success: true as const, data: hours.map(serializeOpeningHour) };
  }
}
