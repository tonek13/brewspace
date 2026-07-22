import type { OrderRecord, OrderItemRecord } from "../repositories/order-repository";

export function serializeOrder(order: OrderRecord & { items?: OrderItemRecord[] }) {
  return {
    id: order.id,
    reservationId: order.reservationId,
    userId: order.userId,
    branchId: order.branchId,
    status: order.status,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    notes: order.notes,
    items: order.items?.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      notes: item.notes,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
