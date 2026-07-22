import type { SeatType, SeatStatus } from "@brewspace/contracts";

export interface SeatRecord {
  id: string;
  branchId: string;
  zoneId: string;
  name: string;
  type: SeatType;
  capacity: number;
  status: SeatStatus;
  description: string | null;
  reservable: boolean;
  hourlyPriceCents: number | null;
  nearWindow: boolean;
  hasPowerOutlet: boolean;
  quietArea: boolean;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeatFilter {
  seatType?: SeatType;
  zoneId?: string;
  nearWindow?: boolean;
  hasPowerOutlet?: boolean;
  quietArea?: boolean;
  minCapacity?: number;
}

export interface SeatRepository {
  findByBranch(branchId: string, filter?: SeatFilter): Promise<SeatRecord[]>;
  findById(id: string): Promise<SeatRecord | null>;
  create(input: Omit<SeatRecord, "id" | "createdAt" | "updatedAt">): Promise<SeatRecord>;
  update(id: string, input: Partial<Omit<SeatRecord, "id" | "createdAt" | "updatedAt">>): Promise<SeatRecord>;
}
