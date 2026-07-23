import { nanoid } from "nanoid";
import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";
import type { AuthContext } from "../types";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export class SessionService {
  constructor(private readonly redis: Redis) {}

  async create(context: AuthContext): Promise<string> {
    const sessionId = nanoid(32);
    // The session id is also tracked in a per-user set so a password reset can
    // revoke every active session, not just the current one.
    const pipeline = this.redis.pipeline();
    pipeline.set(redisKeys.session(sessionId), JSON.stringify(context), "EX", SESSION_TTL_SECONDS);
    pipeline.sadd(redisKeys.userSessions(context.userId), sessionId);
    pipeline.expire(redisKeys.userSessions(context.userId), SESSION_TTL_SECONDS);
    await pipeline.exec();
    return sessionId;
  }

  async resolve(sessionId: string): Promise<AuthContext | null> {
    const raw = await this.redis.get(redisKeys.session(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as AuthContext;
  }

  async destroy(sessionId: string): Promise<void> {
    const context = await this.resolve(sessionId);
    const pipeline = this.redis.pipeline();
    pipeline.del(redisKeys.session(sessionId));
    if (context) pipeline.srem(redisKeys.userSessions(context.userId), sessionId);
    await pipeline.exec();
  }

  /** Revokes every session for a user — used after a password reset. */
  async destroyAllForUser(userId: string): Promise<void> {
    const setKey = redisKeys.userSessions(userId);
    const sessionIds = await this.redis.smembers(setKey);
    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) pipeline.del(redisKeys.session(id));
    pipeline.del(setKey);
    await pipeline.exec();
  }
}
