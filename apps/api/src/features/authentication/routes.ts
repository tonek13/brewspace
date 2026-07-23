import { Elysia } from "elysia";
import { db } from "../../database/client";
import { redis } from "../../infrastructure/redis";
import { DrizzleUserRepository } from "./repositories/drizzle-user-repository";
import { SessionService } from "./services/session-service";
import { PasswordResetService } from "./services/password-reset-service";
import { LoggingPasswordResetMailer, ResendPasswordResetMailer } from "./services/password-reset-mailer";
import { AuthService } from "./services/auth-service";
import { AuthController, SESSION_COOKIE } from "./controllers/auth-controller";
import { toErrorResponse } from "../../shared/http-response";
import { readSessionCookie } from "../../shared/cookie-jar";
import { env } from "../../config/env";

const userRepository = new DrizzleUserRepository(db);
const sessionService = new SessionService(redis);
const passwordResetService = new PasswordResetService(redis);
// Real emails go out through Resend when an API key is configured; otherwise the
// link is written to the logs so the flow stays usable in local dev.
const passwordResetMailer = env.RESEND_API_KEY
  ? new ResendPasswordResetMailer(env.RESEND_API_KEY, env.MAIL_FROM)
  : new LoggingPasswordResetMailer();
const authService = new AuthService(
  userRepository,
  sessionService,
  passwordResetService,
  passwordResetMailer,
  env.APP_WEB_URL ?? env.CORS_ORIGIN,
);
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
  .post("/password-reset-requests", async ({ body, set }) => {
    try {
      return await controller.requestPasswordReset(body);
    } catch (error) {
      return toErrorResponse(error, set);
    }
  })
  .post("/password-resets", async ({ body, set }) => {
    try {
      return await controller.resetPassword(body);
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

export { sessionService, passwordResetMailer };
