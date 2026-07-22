import type { SeatRecord } from "../repositories/seat-repository";
import type { SeatDto } from "@brewspace/contracts";

export function serializeSeat(seat: SeatRecord): SeatDto {
  return {
    id: seat.id,
    branchId: seat.branchId,
    zoneId: seat.zoneId,
    name: seat.name,
    type: seat.type,
    capacity: seat.capacity,
    status: seat.status,
    description: seat.description,
    reservable: seat.reservable,
    hourlyPriceCents: seat.hourlyPriceCents,
    nearWindow: seat.nearWindow,
    hasPowerOutlet: seat.hasPowerOutlet,
    quietArea: seat.quietArea,
    positionX: seat.positionX,
    positionY: seat.positionY,
    positionZ: seat.positionZ,
    rotationX: seat.rotationX,
    rotationY: seat.rotationY,
    rotationZ: seat.rotationZ,
    scaleX: seat.scaleX,
    scaleY: seat.scaleY,
    scaleZ: seat.scaleZ,
    createdAt: seat.createdAt.toISOString(),
    updatedAt: seat.updatedAt.toISOString(),
  };
}
