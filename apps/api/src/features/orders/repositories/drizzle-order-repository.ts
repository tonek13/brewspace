import { eq, inArray } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { orders, orderItems, orderItemOptions } from "../../../database/schema";
import type { OrderRepository, OrderRecord, OrderItemRecord, CreateOrderInput } from "./order-repository";
import type { OrderStatus } from "@brewspace/contracts";

const ACTIVE_STATUSES: OrderStatus[] = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"];

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<(OrderRecord & { items: OrderItemRecord[] }) | null> {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return null;
    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async findActive(): Promise<OrderRecord[]> {
    return this.db.select().from(orders).where(inArray(orders.status, ACTIVE_STATUSES));
  }

  async createWithItems(input: CreateOrderInput): Promise<OrderRecord & { items: OrderItemRecord[] }> {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          reservationId: input.reservationId,
          userId: input.userId,
          branchId: input.branchId,
          status: input.status,
          subtotalCents: input.subtotalCents,
          taxCents: input.taxCents,
          totalCents: input.totalCents,
          notes: input.notes,
        })
        .returning();
      if (!order) throw new Error("Failed to create order");

      const createdItems: OrderItemRecord[] = [];
      for (const item of input.items) {
        const [created] = await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.totalPriceCents,
            notes: item.notes,
          })
          .returning();
        if (!created) throw new Error("Failed to create order item");
        createdItems.push(created);

        if (item.options.length > 0) {
          await tx.insert(orderItemOptions).values(
            item.options.map((option) => ({
              orderItemId: created.id,
              optionValueId: option.optionValueId,
              nameSnapshot: option.nameSnapshot,
              priceSnapshotCents: option.priceSnapshotCents,
            })),
          );
        }
      }
      return { ...order, items: createdItems };
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<OrderRecord> {
    const [row] = await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    if (!row) throw new Error("Order not found");
    return row;
  }
}
