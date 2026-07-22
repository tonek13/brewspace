import type { ErrorCode } from "@brewspace/contracts";
import { ERROR_STATUS_MAP } from "@brewspace/contracts";

export interface FieldError {
  field: string;
  message: string;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(code: ErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = ERROR_STATUS_MAP[code];
    this.fieldErrors = fieldErrors;
  }
}

export const notFound = (resource: string) =>
  new DomainError("NOT_FOUND", `${resource} was not found.`);

export const unauthorized = (message = "You are not allowed to perform this action.") =>
  new DomainError("UNAUTHORIZED", message);

export const unauthenticated = (message = "Authentication is required.") =>
  new DomainError("UNAUTHENTICATED", message);
