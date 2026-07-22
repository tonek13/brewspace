import { DomainError } from "../../shared/domain-error";

export const notCheckedIn = () =>
  new DomainError(
    "UNAUTHORIZED",
    "Service requests require an active checked-in reservation.",
  );

export const duplicateBillRequest = () =>
  new DomainError("DUPLICATE_BILL_REQUEST", "A bill request is already active for this reservation.");

export const invalidRequestTransition = (from: string, to: string) =>
  new DomainError("INVALID_STATE_TRANSITION", `Cannot move a service request from ${from} to ${to}.`);

export const outsideAssignedZones = () =>
  new DomainError("UNAUTHORIZED", "This request belongs to a zone you are not assigned to.");
