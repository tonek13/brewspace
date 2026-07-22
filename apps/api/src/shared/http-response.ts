import type { Context } from "elysia";
import { ZodError } from "zod";
import { DomainError } from "./domain-error";
import type { ApiErrorBody } from "@brewspace/contracts";

export function toErrorResponse(error: unknown, set: Context["set"]): ApiErrorBody {
  if (error instanceof DomainError) {
    set.status = error.status;
    return {
      success: false,
      error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    };
  }

  if (error instanceof ZodError) {
    set.status = 400;
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid or missing fields.",
        fieldErrors: error.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      },
    };
  }

  set.status = 500;
  console.error(JSON.stringify({ level: "error", message: (error as Error)?.message ?? "unknown error" }));
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", fieldErrors: [] },
  };
}
