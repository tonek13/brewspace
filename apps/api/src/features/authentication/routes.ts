import { Elysia } from "elysia";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleUserRepository } from "./repositories/drizzle-user-repository";
import { SessionService } from "./services/session-service";
import { AuthService } from "./services/auth-service";
import { AuthController, SESSION_COOKIE } from "./controllers/auth-controller";
import { toErrorResponse } from "../../shared/http-response";
import { readSessionCookie } from "../../shared/cookie-jar";

const userRepository = new DrizzleUserRepository(db);
const sessionService = new SessionService(redis);
const authService = new AuthService(userRepository, sessionService);
const controller = new AuthController(authService);

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .post("/register", async ({ body, cookie, set }) => {
    try {
      set.status = 201;
      return await controller.register(body, cookie);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .post("/login", async ({ body, cookie, set }) => {
    try {
      return await controller.login(body, cookie);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .post("/logout", async ({ cookie, set }) => {
    try {
      return await controller.logout(readSessionCookie(cookie, SESSION_COOKIE), cookie);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .get("/me", async ({ cookie, set }) => {
    try {
      return await controller.me(readSessionCookie(cookie, SESSION_COOKIE));
    } catch (error) {
      return toErrorResponse(error, set);
    }
  });

export { sessionService };
