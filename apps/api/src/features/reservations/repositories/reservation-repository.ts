import type { ReservationStatus } from "@brewspace/contracts";

export interface ReservationRecord {
  id: string;
  userId: string;
  branchId: string;
  seatId: string;
  startAt: Date;
  endAt: Date;
  partySize: number;
  status: ReservationStatus;
  reservationCode: string;
  notes: string | null;
  checkedInAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservationInput {
  userId: string;
  branchId: string;
  seatId: string;
  startAt: Date;
  endAt: Date;
  partySize: number;
  reservationCode: string;
  status: ReservationStatus;
  notes?: string;
}

export interface ReservationListFilter {
  userId?: string;
  status?: ReservationStatus;
}

/**
 * The exclusion constraint on the reservations table (see migration
 * 0001_reservation_overlap_guard.sql) is the final authority against
 * double-booking. This repository surfaces a PostgreSQL constraint violation
 * as a typed conflict rather than letting a raw driver error leak upward.
 */
export interface ReservationRepository {
  findById(id: string): Promise<ReservationRecord | null>;
  findByCode(code: string): Promise<ReservationRecord | null>;
  findMany(filter: ReservationListFilter, page: number, pageSize: number): Promise<{ items: ReservationRecord[]; total: number }>;
  create(input: CreateReservationInput): Promise<ReservationRecord>;
  updateStatus(id: string, status: ReservationStatus, extra?: Partial<ReservationRecord>): Promise<ReservationRecord>;
  updateEndAt(id: string, endAt: Date): Promise<ReservationRecord>;
}

export const RESERVATION_OVERLAP_SQLSTATE = "23P01";
