import { nanoid } from "nanoid";
import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";
import { env } from "../../../config/env";

export interface SeatHold {
  token: string;
  seatId: string;
  branchId: string;
  userId: string;
  startAt: string;
  endAt: string;
  partySize: number;
}

const HOLD_TTL = env.SEAT_HOLD_TTL_SECONDS;

/**
 * Temporary seat holds live only in Redis, keyed both by seat (to block other
 * customers instantly) and by an opaque token (so the holder can confirm or
 * release it). Both keys share the same TTL and are written atomically via a
 * pipeline so a hold can never exist in one without the other.
 */
export class HoldRepository {
  constructor(private readonly redis: Redis) {}

  async create(input: Omit<SeatHold, "token">): Promise<SeatHold> {
    const token = nanoid(24);
    const hold: SeatHold = { ...input, token };
    const payload = JSON.stringify(hold);

    const pipeline = this.redis.pipeline();
    pipeline.set(redisKeys.seatHold(input.branchId, input.seatId), payload, "EX", HOLD_TTL, "NX");
    pipeline.set(redisKeys.holdToken(token), payload, "EX", HOLD_TTL);
    const results = await pipeline.exec();

    const seatHoldSet = results?.[0]?.[1];
    if (seatHoldSet !== "OK") {
      await this.redis.del(redisKeys.holdToken(token));
      return null as unknown as SeatHold; // seat already held; caller checks for null via findActiveForSeat
    }
    return hold;
  }

  async findByToken(token: string): Promise<SeatHold | null> {
    const raw = await this.redis.get(redisKeys.holdToken(token));
    return raw ? (JSON.parse(raw) as SeatHold) : null;
  }

  async findActiveForSeat(branchId: string, seatId: string): Promise<SeatHold | null> {
    const raw = await this.redis.get(redisKeys.seatHold(branchId, seatId));
    return raw ? (JSON.parse(raw) as SeatHold) : null;
  }

  async release(token: string): Promise<void> {
    const hold = await this.findByToken(token);
    if (!hold) return;
    const pipeline = this.redis.pipeline();
    pipeline.del(redisKeys.holdToken(token));
    pipeline.del(redisKeys.seatHold(hold.branchId, hold.seatId));
    await pipeline.exec();
  }

  async consume(token: string): Promise<SeatHold | null> {
    const hold = await this.findByToken(token);
    if (!hold) return null;
    await this.release(token);
    return hold;
  }
}
