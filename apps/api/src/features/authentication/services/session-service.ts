import { nanoid } from "nanoid";
import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";
import type { AuthContext } from "../types";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export class SessionService {
  constructor(private readonly redis: Redis) {}

  async create(context: AuthContext): Promise<string> {
    const sessionId = nanoid(32);
    await this.redis.set(
      redisKeys.session(sessionId),
      JSON.stringify(context),
      "EX",
      SESSION_TTL_SECONDS,
    );
    return sessionId;
  }

  async resolve(sessionId: string): Promise<AuthContext | null> {
    const raw = await this.redis.get(redisKeys.session(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as AuthContext;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(redisKeys.session(sessionId));
  }
}
