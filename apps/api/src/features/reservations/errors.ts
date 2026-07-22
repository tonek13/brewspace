import { DomainError } from "../../shared/domain-error";

export const reservationConflict = () =>
  new DomainError("RESERVATION_CONFLICT", "The selected seat is no longer available.");

export const invalidTransition = (from: string, to: string) =>
  new DomainError("INVALID_STATE_TRANSITION", `Cannot move a reservation from ${from} to ${to}.`);

export const cannotCancelCheckedIn = () =>
  new DomainError(
    "INVALID_STATE_TRANSITION",
    "A checked-in reservation cannot be cancelled through this action.",
  );

export const invalidReservationCode = () =>
  new DomainError("NOT_FOUND", "No reservation matches this code.");
