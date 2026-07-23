import { createHash, randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";

const RESET_TTL_SECONDS = 60 * 30; // 30 minutes

/**
 * Password reset tokens live in Redis with a short TTL. Only the SHA-256 of the
 * token is stored, so a dump of Redis can't be replayed to take over accounts —
 * the raw token exists solely in the email we send. Redeeming a token deletes
 * it, making every link single-use.
 */
export class PasswordResetService {
  constructor(private readonly redis: Redis) {}

  private static digest(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.redis.set(
      redisKeys.passwordReset(PasswordResetService.digest(token)),
      userId,
      "EX",
      RESET_TTL_SECONDS,
    );
    return token;
  }

  /** Returns the user id and burns the token, or null when invalid/expired. */
  async consume(token: string): Promise<string | null> {
    const key = redisKeys.passwordReset(PasswordResetService.digest(token));
    const userId = await this.redis.get(key);
    if (!userId) return null;
    await this.redis.del(key);
    return userId;
  }
}
