import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import { request, resetState, sessionCookieFrom } from "../helpers";
import { createUser } from "../factories";
import { passwordResetMailer } from "../../src/features/authentication/routes";

const NEW_PASSWORD = "a-brand-new-password";

/** Pulls the one-time token out of the link the mailer was handed. */
function tokenFrom(spy: MockInstance): string {
  const call = spy.mock.calls[0]?.[0] as { resetUrl: string } | undefined;
  if (!call) throw new Error("Mailer was not called");
  const token = new URL(call.resetUrl).searchParams.get("token");
  if (!token) throw new Error(`No token in reset URL: ${call.resetUrl}`);
  return token;
}

describe("password reset", () => {
  let sendSpy: MockInstance;

  beforeEach(async () => {
    await resetState();
    sendSpy = vi.spyOn(passwordResetMailer, "send").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/auth/password-reset-requests", () => {
    it("issues a reset link for a known address", async () => {
      await createUser({ email: "knows@example.com" });
      const response = await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "knows@example.com" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it("returns the same success for an unknown address and sends nothing", async () => {
      const response = await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "nobody@example.com" },
      });

      // Identical response shape to the known-address case: no enumeration.
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/password-resets", () => {
    it("sets a new password that then works for login", async () => {
      const user = await createUser({ email: "resetme@example.com" });
      await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "resetme@example.com" },
      });

      const reset = await request("POST", "/api/v1/auth/password-resets", {
        body: { token: tokenFrom(sendSpy), password: NEW_PASSWORD },
      });
      expect(reset.status).toBe(200);

      const withNew = await request("POST", "/api/v1/auth/login", {
        body: { email: "resetme@example.com", password: NEW_PASSWORD },
      });
      expect(withNew.status).toBe(200);

      const withOld = await request("POST", "/api/v1/auth/login", {
        body: { email: "resetme@example.com", password: user.plainPassword },
      });
      expect(withOld.status).toBe(401);
    });

    it("revokes sessions that existed before the reset", async () => {
      const user = await createUser({ email: "sessions@example.com" });
      const login = await request("POST", "/api/v1/auth/login", {
        body: { email: "sessions@example.com", password: user.plainPassword },
      });
      const cookie = sessionCookieFrom(login);
      expect((await request("GET", "/api/v1/auth/me", { cookie })).status).toBe(200);

      await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "sessions@example.com" },
      });
      await request("POST", "/api/v1/auth/password-resets", {
        body: { token: tokenFrom(sendSpy), password: NEW_PASSWORD },
      });

      expect((await request("GET", "/api/v1/auth/me", { cookie })).status).toBe(401);
    });

    it("rejects an unknown token", async () => {
      const response = await request("POST", "/api/v1/auth/password-resets", {
        body: { token: "not-a-real-token-at-all", password: NEW_PASSWORD },
      });
      expect(response.status).toBe(400);
      expect((response.body.error as { code: string }).code).toBe("VALIDATION_ERROR");
    });

    it("burns the token so a link cannot be reused", async () => {
      await createUser({ email: "once@example.com" });
      await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "once@example.com" },
      });
      const token = tokenFrom(sendSpy);

      expect(
        (await request("POST", "/api/v1/auth/password-resets", { body: { token, password: NEW_PASSWORD } })).status,
      ).toBe(200);
      expect(
        (await request("POST", "/api/v1/auth/password-resets", { body: { token, password: "yet-another-password" } }))
          .status,
      ).toBe(400);
    });

    it("rejects a password below the minimum length", async () => {
      await createUser({ email: "shortpw@example.com" });
      await request("POST", "/api/v1/auth/password-reset-requests", {
        body: { email: "shortpw@example.com" },
      });

      const response = await request("POST", "/api/v1/auth/password-resets", {
        body: { token: tokenFrom(sendSpy), password: "short" },
      });
      expect(response.status).toBe(400);
      const error = response.body.error as { fieldErrors: { field: string }[] };
      expect(error.fieldErrors.some((f) => f.field === "password")).toBe(true);
    });
  });
});
