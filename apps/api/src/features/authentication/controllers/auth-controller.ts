import type { AuthService } from "../services/auth-service";
import { serializeUser } from "../serializers/user-serializer";
import { registerRequestSchema, loginRequestSchema } from "@brewspace/contracts";
import { unauthenticated } from "../../../shared/domain-error";
import type { SessionCookieJar } from "../../../shared/cookie-jar";

const SESSION_COOKIE = "brewspace_session";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(body: unknown, cookie: SessionCookieJar) {
    const input = registerRequestSchema.parse(body);
    const { user, sessionId } = await this.authService.register(input);
    this.setSessionCookie(cookie, sessionId);
    return { success: true as const, data: serializeUser(user) };
  }

  async login(body: unknown, cookie: SessionCookieJar) {
    const input = loginRequestSchema.parse(body);
    const { user, sessionId } = await this.authService.login(input);
    this.setSessionCookie(cookie, sessionId);
    return { success: true as const, data: serializeUser(user) };
  }

  async logout(sessionId: string | undefined, cookie: SessionCookieJar) {
    if (sessionId) await this.authService.logout(sessionId);
    cookie[SESSION_COOKIE]?.remove();
    return { success: true as const, data: null };
  }

  async me(sessionId: string | undefined) {
    if (!sessionId) throw unauthenticated();
    const user = await this.authService.me(sessionId);
    if (!user) throw unauthenticated();
    return { success: true as const, data: serializeUser(user) };
  }

  private setSessionCookie(cookie: SessionCookieJar, sessionId: string) {
    // When the web app and API are served from different origins (production
    // split deploy), the browser only sends the session cookie on cross-site
    // requests if it's SameSite=None + Secure. COOKIE_SECURE gates that.
    const crossSite = process.env.COOKIE_SECURE === "true";
    cookie[SESSION_COOKIE]?.set({
      value: sessionId,
      httpOnly: true,
      sameSite: crossSite ? "none" : "lax",
      secure: crossSite,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}

export { SESSION_COOKIE };
