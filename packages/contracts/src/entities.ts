import { z } from "zod";
import {
  USER_ROLES,
  USER_STATUSES,
  SEAT_TYPES,
  SEAT_STATUSES,
  RESERVATION_STATUSES,
  SERVICE_REQUEST_TYPES,
  SERVICE_REQUEST_STATUSES,
  ORDER_STATUSES,
  ZONE_TYPES,
} from "./enums";

export const userSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof userSchema>;

export const branchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  address: z.string().min(1),
  timezone: z.string().min(1),
  phone: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BranchDto = z.infer<typeof branchSchema>;

export const openingHourSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean(),
});
export type OpeningHourDto = z.infer<typeof openingHourSchema>;

export const zoneSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  type: z.enum(ZONE_TYPES),
  floorNumber: z.number().int(),
  active: z.boolean(),
});
export type ZoneDto = z.infer<typeof zoneSchema>;

export const seatSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  zoneId: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(SEAT_TYPES),
  capacity: z.number().int().min(1).max(50),
  status: z.enum(SEAT_STATUSES),
  description: z.string().nullable(),
  reservable: z.boolean(),
  hourlyPriceCents: z.number().int().min(0).nullable(),
  nearWindow: z.boolean(),
  hasPowerOutlet: z.boolean(),
  quietArea: z.boolean(),
  positionX: z.number(),
  positionY: z.number(),
  positionZ: z.number(),
  rotationX: z.number(),
  rotationY: z.number(),
  rotationZ: z.number(),
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
  scaleZ: z.number().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SeatDto = z.infer<typeof seatSchema>;

/** Derived, request-scoped seat state — not persisted on the seat row itself. */
export const seatAvailabilityStateSchema = z.enum([
  "AVAILABLE",
  "HELD",
  "RESERVED",
  "OCCUPIED",
  "UNAVAILABLE",
  "MAINTENANCE",
]);
export type SeatAvailabilityState = z.infer<typeof seatAvailabilityStateSchema>;

export const reservationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  seatId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  partySize: z.number().int().min(1),
  status: z.enum(RESERVATION_STATUSES),
  reservationCode: z.string(),
  notes: z.string().nullable(),
  checkedInAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReservationDto = z.infer<typeof reservationSchema>;

export const serviceRequestSchema = z.object({
  id: z.string().uuid(),
  reservationId: z.string().uuid(),
  customerId: z.string().uuid(),
  assignedWaiterId: z.string().uuid().nullable(),
  zoneId: z.string().uuid(),
  type: z.enum(SERVICE_REQUEST_TYPES),
  message: z.string().nullable(),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
});
export type ServiceRequestDto = z.infer<typeof serviceRequestSchema>;

export const menuItemSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  priceCents: z.number().int().min(0),
  imageUrl: z.string().url().nullable(),
  active: z.boolean(),
  available: z.boolean(),
});
export type MenuItemDto = z.infer<typeof menuItemSchema>;

export const orderSchema = z.object({
  id: z.string().uuid(),
  reservationId: z.string().uuid(),
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrderDto = z.infer<typeof orderSchema>;
