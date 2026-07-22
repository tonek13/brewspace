export const USER_ROLES = ["CUSTOMER", "WAITER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SEAT_TYPES = ["TABLE", "WORK_DESK", "MEETING_TABLE", "LOUNGE_SEAT", "SOFA"] as const;
export type SeatType = (typeof SEAT_TYPES)[number];

export const SEAT_STATUSES = ["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export const RESERVATION_STATUSES = [
  "HELD",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const SERVICE_REQUEST_TYPES = [
  "CALL_WAITER",
  "REQUEST_MENU",
  "REQUEST_WATER",
  "REQUEST_ASSISTANCE",
  "REQUEST_BILL",
  "OTHER",
] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ZONE_TYPES = ["MAIN_FLOOR", "WORKSPACE", "MEETING_AREA", "LOUNGE", "OUTDOOR"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

/**
 * Centralized status-transition tables. Services must consult these rather than
 * re-implementing transition rules inline, and frontend status badges/colors
 * derive from the same source instead of hardcoding per-component logic.
 */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  HELD: ["CONFIRMED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  NO_SHOW: [],
};

export const SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "REJECTED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

export function canTransition<T extends string>(
  table: Record<T, T[]>,
  from: T,
  to: T,
): boolean {
  return table[from]?.includes(to) ?? false;
}
