import { ORDER_TRANSITIONS, canTransition } from "@brewspace/contracts";
import type { OrderStatus } from "@brewspace/contracts";
import type { OrderRepository, OrderRecord, OrderItemRecord } from "../repositories/order-repository";
import type { ReservationRepository } from "../../reservations";
import type { MenuRepository } from "../../menu";
import type { EventPublisher } from "../../service-requests";
import { notFound, unauthorized } from "../../../shared/domain-error";
import { orderRequiresCheckIn, itemNotOrderable, invalidOrderTransition } from "../errors";
import { computeTaxCents, computeLineTotal } from "./pricing";

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
  optionValueIds?: string[];
}

export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly menuRepository: MenuRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async submit(
    reservationId: string,
    userId: string,
    items: OrderItemInput[],
    notes?: string,
  ): Promise<OrderRecord & { items: OrderItemRecord[] }> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw notFound("Reservation");
    if (reservation.userId !== userId) throw unauthorized();
    if (reservation.status !== "CHECKED_IN") throw orderRequiresCheckIn();

    let subtotalCents = 0;
    const preparedItems = [];

    for (const item of items) {
      const menuItem = await this.menuRepository.findItemById(item.menuItemId);
      if (!menuItem) throw notFound("Menu item");
      if (!menuItem.active || !menuItem.available) throw itemNotOrderable(menuItem.name);

      const optionValues = await this.menuRepository.findOptionValues(item.optionValueIds ?? []);
      const optionCents = optionValues.reduce((sum, value) => sum + value.additionalPriceCents, 0);
      const lineTotal = computeLineTotal(menuItem.priceCents, optionCents, item.quantity);
      subtotalCents += lineTotal;

      preparedItems.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        unitPriceCents: menuItem.priceCents,
        totalPriceCents: lineTotal,
        notes: item.notes,
        options: optionValues.map((value) => ({
          optionValueId: value.id,
          nameSnapshot: value.name,
          priceSnapshotCents: value.additionalPriceCents,
        })),
      });
    }

    const taxCents = computeTaxCents(subtotalCents);
    const order = await this.orderRepository.createWithItems({
      reservationId,
      userId,
      branchId: reservation.branchId,
      status: "SUBMITTED",
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      notes,
      items: preparedItems,
    });

    await this.eventPublisher.publish(reservation.branchId, {
      kind: "order.submitted",
      orderId: order.id,
      reservationId,
    });
    return order;
  }

  async get(orderId: string, requester: { userId: string; role: string }) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw notFound("Order");
    const isOwner = order.userId === requester.userId;
    const isStaff = requester.role === "ADMIN" || requester.role === "WAITER";
    if (!isOwner && !isStaff) throw unauthorized();
    return order;
  }

  async listActiveForStaff(): Promise<OrderRecord[]> {
    return this.orderRepository.findActive();
  }

  async updateStatus(orderId: string, target: OrderStatus): Promise<OrderRecord> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw notFound("Order");
    if (!canTransition(ORDER_TRANSITIONS, order.status, target)) {
      throw invalidOrderTransition(order.status, target);
    }
    const updated = await this.orderRepository.updateStatus(orderId, target);
    await this.eventPublisher.publish(order.branchId, {
      kind: "order.updated",
      orderId,
      status: target,
    });
    return updated;
  }
}
