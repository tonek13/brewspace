import { z } from "zod";
import { SEAT_TYPES, SERVICE_REQUEST_TYPES } from "./enums";

export const registerRequestSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Step 1 of a password reset — asks for a reset link to be emailed. */
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

/** Step 2 — redeems the emailed token and sets a new password. */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(10).max(128),
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  partySize: z.coerce.number().int().min(1).max(50),
  seatType: z.enum(SEAT_TYPES).optional(),
  zoneId: z.string().uuid().optional(),
  nearWindow: z.coerce.boolean().optional(),
  hasPowerOutlet: z.coerce.boolean().optional(),
  quietArea: z.coerce.boolean().optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const createHoldRequestSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  partySize: z.number().int().min(1),
});
export type CreateHoldRequest = z.infer<typeof createHoldRequestSchema>;

export const createReservationRequestSchema = z.object({
  holdToken: z.string().min(1).max(64),
  notes: z.string().max(500).optional(),
});
export type CreateReservationRequest = z.infer<typeof createReservationRequestSchema>;

export const cancelReservationRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelReservationRequest = z.infer<typeof cancelReservationRequestSchema>;

export const extendReservationRequestSchema = z.object({
  newEndAt: z.string().datetime(),
});
export type ExtendReservationRequest = z.infer<typeof extendReservationRequestSchema>;

export const checkInRequestSchema = z.object({
  reservationCode: z.string().min(1),
});
export type CheckInRequest = z.infer<typeof checkInRequestSchema>;

export const createServiceRequestSchema = z.object({
  type: z.enum(SERVICE_REQUEST_TYPES),
  message: z.string().max(500).optional(),
});
export type CreateServiceRequestRequest = z.infer<typeof createServiceRequestSchema>;

export const updateServiceRequestStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"]),
  rejectionReason: z.string().max(500).optional(),
});
export type UpdateServiceRequestStatusRequest = z.infer<typeof updateServiceRequestStatusSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
