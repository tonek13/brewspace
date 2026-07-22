import type { OrderStatus } from "@brewspace/contracts";

export interface OrderRecord {
  id: string;
  reservationId: string;
  userId: string;
  branchId: string;
  status: OrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  notes: string | null;
}

export interface CreateOrderInput {
  reservationId: string;
  userId: string;
  branchId: string;
  status: OrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string;
  items: {
    menuItemId: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    notes?: string;
    options: { optionValueId: string; nameSnapshot: string; priceSnapshotCents: number }[];
  }[];
}

export interface OrderRepository {
  findById(id: string): Promise<(OrderRecord & { items: OrderItemRecord[] }) | null>;
  findActive(): Promise<OrderRecord[]>;
  createWithItems(input: CreateOrderInput): Promise<OrderRecord & { items: OrderItemRecord[] }>;
  updateStatus(id: string, status: OrderStatus): Promise<OrderRecord>;
}
