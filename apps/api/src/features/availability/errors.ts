import { DomainError } from "../../shared/domain-error";

export const seatUnavailable = () =>
  new DomainError("SEAT_UNAVAILABLE", "This seat is not available for the requested time.");

export const capacityExceeded = (capacity: number) =>
  new DomainError(
    "CAPACITY_EXCEEDED",
    `This seat can only accommodate up to ${capacity} guests.`,
    [{ field: "partySize", message: `Maximum capacity is ${capacity}.` }],
  );

export const holdNotFound = () =>
  new DomainError("HOLD_NOT_FOUND", "This hold no longer exists or has expired.");

export const invalidReservationWindow = (message: string) =>
  new DomainError("VALIDATION_ERROR", message, [{ field: "startAt", message }]);
