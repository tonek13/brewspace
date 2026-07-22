import type { OpeningHourRecord } from "../repositories/branch-repository";
import { DomainError } from "../../../shared/domain-error";

/**
 * Validates that [startAt, endAt) falls entirely within the branch's configured
 * opening hours for the day it starts on. Reservations spanning midnight into a
 * closed period are rejected — cross-midnight opening hours are out of scope for
 * the first release.
 */
export function assertWithinOpeningHours(
  hours: OpeningHourRecord[],
  startAt: Date,
  endAt: Date,
  timezone: string,
): void {
  const dayOfWeek = weekdayIndex(startAt, timezone);

  const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!dayHours || dayHours.closed) {
    throw new DomainError("OUTSIDE_OPENING_HOURS", "The branch is closed on the selected day.");
  }

  const startMinutes = localMinutesOfDay(startAt, timezone);
  // A window ending at or past local midnight wraps endMinutes back to a small
  // number; treating that as 24h+ keeps the closing-time comparison honest.
  const rawEndMinutes = localMinutesOfDay(endAt, timezone);
  const endMinutes = rawEndMinutes <= startMinutes ? rawEndMinutes + 24 * 60 : rawEndMinutes;
  const opensMinutes = timeToMinutes(dayHours.opensAt);
  const closesMinutes = timeToMinutes(dayHours.closesAt);

  if (startMinutes < opensMinutes || endMinutes > closesMinutes) {
    throw new DomainError(
      "OUTSIDE_OPENING_HOURS",
      "The selected time falls outside the branch's opening hours.",
    );
  }
}

function weekdayIndex(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" });
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names.indexOf(formatter.format(date));
}

function localMinutesOfDay(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
