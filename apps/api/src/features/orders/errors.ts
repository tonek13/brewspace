import { DomainError } from "../../shared/domain-error";

export const orderRequiresCheckIn = () =>
  new DomainError("UNAUTHORIZED", "Ordering requires an active checked-in reservation.");

export const itemNotOrderable = (name: string) =>
  new DomainError("VALIDATION_ERROR", `"${name}" is currently unavailable.`, [
    { field: "items", message: `${name} is unavailable.` },
  ]);

export const invalidOrderTransition = (from: string, to: string) =>
  new DomainError("INVALID_STATE_TRANSITION", `Cannot move an order from ${from} to ${to}.`);
