import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";

export type StaffEvent =
  | { kind: "service-request.created"; requestId: string; zoneId: string; type: string }
  | { kind: "service-request.updated"; requestId: string; zoneId: string; status: string }
  | { kind: "order.submitted"; orderId: string; reservationId: string }
  | { kind: "order.updated"; orderId: string; status: string };

export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(branchId: string, event: StaffEvent): Promise<void> {
    await this.redis.publish(redisKeys.events(branchId), JSON.stringify(event));
  }
}
