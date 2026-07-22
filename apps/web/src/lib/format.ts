import type { ReservationStatus, ServiceRequestStatus, OrderStatus } from "@brewspace/contracts";
import type { SeatAvailabilityState } from "./api-client";

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

const RESERVATION_TONE: Record<ReservationStatus, string> = {
  HELD: "bg-crema/15 text-crema-deep",
  CONFIRMED: "bg-sage/15 text-sage",
  CHECKED_IN: "bg-ink text-paper",
  COMPLETED: "bg-line text-steam",
  CANCELLED: "bg-clay/12 text-clay",
  EXPIRED: "bg-line text-steam",
  NO_SHOW: "bg-clay/12 text-clay",
};

export function reservationTone(status: ReservationStatus): string {
  return RESERVATION_TONE[status];
}

const REQUEST_TONE: Record<ServiceRequestStatus, string> = {
  PENDING: "bg-crema/15 text-crema-deep",
  ACCEPTED: "bg-sage/15 text-sage",
  IN_PROGRESS: "bg-ink text-paper",
  COMPLETED: "bg-line text-steam",
  REJECTED: "bg-clay/12 text-clay",
  CANCELLED: "bg-line text-steam",
};

export function requestTone(status: ServiceRequestStatus): string {
  return REQUEST_TONE[status];
}

const ORDER_TONE: Record<OrderStatus, string> = {
  DRAFT: "bg-line text-steam",
  SUBMITTED: "bg-crema/15 text-crema-deep",
  ACCEPTED: "bg-sage/15 text-sage",
  PREPARING: "bg-crema/15 text-crema-deep",
  READY: "bg-sage/15 text-sage",
  SERVED: "bg-ink text-paper",
  CANCELLED: "bg-clay/12 text-clay",
};

export function orderTone(status: OrderStatus): string {
  return ORDER_TONE[status];
}

// Seat availability -> hex colors for the 3D map meshes
export const SEAT_STATE_COLORS: Record<SeatAvailabilityState, string> = {
  AVAILABLE: "#5F7F5C",
  HELD: "#C8874B",
  RESERVED: "#B5533C",
  OCCUPIED: "#8A5A3C",
  UNAVAILABLE: "#B8AE9E",
  MAINTENANCE: "#7C8A94",
};

export const SEAT_STATE_LABEL: Record<SeatAvailabilityState, string> = {
  AVAILABLE: "Available",
  HELD: "On hold",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  UNAVAILABLE: "Unavailable",
  MAINTENANCE: "Maintenance",
};

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
