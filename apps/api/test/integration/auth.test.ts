import { describe, it, expect, beforeEach } from "vitest";
import { request, resetState, sessionCookieFrom } from "../helpers";
import { createUser } from "../factories";

describe("authentication", () => {
  beforeEach(resetState);

  describe("POST /api/v1/auth/register", () => {
    it("creates an account and starts a session", async () => {
      const response = await request("POST", "/api/v1/auth/register", {
        body: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", password: "a-strong-password" },
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: { email: "ada@example.com", role: "CUSTOMER", status: "ACTIVE" },
      });
      expect((response.body.data as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(sessionCookieFrom(response)).toContain("brewspace_session=");
    });

    it("rejects a duplicate email with a field error", async () => {
      await createUser({ email: "taken@example.com" });
      const response = await request("POST", "/api/v1/auth/register", {
        body: { firstName: "A", lastName: "B", email: "taken@example.com", password: "a-strong-password" },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    });

    it("rejects a short password", async () => {
      const response = await request("POST", "/api/v1/auth/register", {
        body: { firstName: "A", lastName: "B", email: "short@example.com", password: "short" },
      });
      expect(response.status).toBe(400);
      const error = response.body.error as { code: string; fieldErrors: { field: string }[] };
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.fieldErrors.some((f) => f.field === "password")).toBe(true);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in with valid credentials", async () => {
      const user = await createUser({ email: "login@example.com" });
      const response = await request("POST", "/api/v1/auth/login", {
        body: { email: "login@example.com", password: user.plainPassword },
      });
      expect(response.status).toBe(200);
      expect((response.body.data as Record<string, unknown>).email).toBe("login@example.com");
    });

    it("returns a generic failure for a wrong password", async () => {
      await createUser({ email: "victim@example.com" });
      const response = await request("POST", "/api/v1/auth/login", {
        body: { email: "victim@example.com", password: "wrong-password-guess" },
      });
      expect(response.status).toBe(401);
      expect((response.body.error as { message: string }).message).toBe("Invalid email or password.");
    });

    it("returns the same generic failure for an unknown email", async () => {
      const response = await request("POST", "/api/v1/auth/login", {
        body: { email: "nobody@example.com", password: "whatever-password" },
      });
      expect(response.status).toBe(401);
      expect((response.body.error as { message: string }).message).toBe("Invalid email or password.");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns the current user for a valid session", async () => {
      const registration = await request("POST", "/api/v1/auth/register", {
        body: { firstName: "Me", lastName: "Self", email: "me@example.com", password: "a-strong-password" },
      });
      const cookie = sessionCookieFrom(registration);
      const response = await request("GET", "/api/v1/auth/me", { cookie });
      expect(response.status).toBe(200);
      expect((response.body.data as Record<string, unknown>).email).toBe("me@example.com");
    });

    it("returns 401 without a session", async () => {
      const response = await request("GET", "/api/v1/auth/me");
      expect(response.status).toBe(401);
    });

    it("returns 401 after logout", async () => {
      const registration = await request("POST", "/api/v1/auth/register", {
        body: { firstName: "Out", lastName: "Going", email: "out@example.com", password: "a-strong-password" },
      });
      const cookie = sessionCookieFrom(registration);
      await request("POST", "/api/v1/auth/logout", { cookie });
      const response = await request("GET", "/api/v1/auth/me", { cookie });
      expect(response.status).toBe(401);
    });
  });
});
