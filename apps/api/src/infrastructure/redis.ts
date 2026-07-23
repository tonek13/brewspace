import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (error) => {
  console.error(JSON.stringify({ level: "error", scope: "redis", message: error.message }));
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export const redisKeys = {
  seatHold: (branchId: string, seatId: string) => `brewspace:seat-hold:${branchId}:${seatId}`,
  holdToken: (token: string) => `brewspace:hold-token:${token}`,
  menu: (branchId: string) => `brewspace:menu:${branchId}`,
  session: (sessionId: string) => `brewspace:session:${sessionId}`,
  /** Set of a user's live session ids, so every device can be signed out at once. */
  userSessions: (userId: string) => `brewspace:user-sessions:${userId}`,
  /** Keyed by the SHA-256 of the reset token, never the token itself. */
  passwordReset: (tokenHash: string) => `brewspace:password-reset:${tokenHash}`,
  rateLimit: (bucket: string, key: string) => `brewspace:rate-limit:${bucket}:${key}`,
  events: (branchId: string) => `brewspace:events:${branchId}`,
} as const;
