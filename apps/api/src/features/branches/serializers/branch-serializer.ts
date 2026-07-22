import type { BranchRecord, OpeningHourRecord } from "../repositories/branch-repository";
import type { BranchDto, OpeningHourDto } from "@brewspace/contracts";

export function serializeBranch(branch: BranchRecord): BranchDto {
  return {
    id: branch.id,
    name: branch.name,
    description: branch.description,
    address: branch.address,
    timezone: branch.timezone,
    phone: branch.phone,
    latitude: branch.latitude,
    longitude: branch.longitude,
    active: branch.active,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  };
}

export function serializeOpeningHour(hour: OpeningHourRecord): OpeningHourDto {
  return {
    id: hour.id,
    branchId: hour.branchId,
    dayOfWeek: hour.dayOfWeek,
    opensAt: hour.opensAt.slice(0, 5),
    closesAt: hour.closesAt.slice(0, 5),
    closed: hour.closed,
  };
}
