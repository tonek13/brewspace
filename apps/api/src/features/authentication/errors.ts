import { DomainError } from "../../shared/domain-error";

export const emailAlreadyRegistered = () =>
  new DomainError("VALIDATION_ERROR", "An account with this email already exists.", [
    { field: "email", message: "Email is already registered." },
  ]);

export const invalidCredentials = () =>
  new DomainError("UNAUTHENTICATED", "Invalid email or password.");

export const accountSuspended = () =>
  new DomainError("UNAUTHENTICATED", "This account has been suspended.");
