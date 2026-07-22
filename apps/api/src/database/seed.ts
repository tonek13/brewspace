import { db, closeDatabase } from "./client";
import {
  users, branches, openingHours, zones, seats, menuCategories, menuItems,
  reservations, orders, orderItems, staffZoneAssignments,
} from "./schema";
import { PasswordService } from "../features/authentication/services/password-service";
import { generateReservationCode } from "../features/reservations/services/reservation-code-generator";

async function seed(): Promise<void> {
  const password = await PasswordService.hash("brewspace-dev-password");

  const [admin] = await db.insert(users).values({
    firstName: "Avery", lastName: "Admin", email: "admin@brewspace.dev",
    passwordHash: password, role: "ADMIN",
  }).returning();
  const [waiterOne] = await db.insert(users).values({
    firstName: "Wren", lastName: "Waiter", email: "waiter1@brewspace.dev",
    passwordHash: password, role: "WAITER",
  }).returning();
  const [waiterTwo] = await db.insert(users).values({
    firstName: "Wade", lastName: "Waiter", email: "waiter2@brewspace.dev",
    passwordHash: password, role: "WAITER",
  }).returning();
  const [customer] = await db.insert(users).values({
    firstName: "Casey", lastName: "Customer", email: "customer@brewspace.dev",
    passwordHash: password, role: "CUSTOMER",
  }).returning();
  if (!admin || !waiterOne || !waiterTwo || !customer) throw new Error("seed: user insert failed");

  const [branch] = await db.insert(branches).values({
    name: "BrewSpace Downtown",
    description: "Flagship workspace café with quiet zones and meeting tables.",
    address: "12 Roastery Lane",
    timezone: "UTC",
    phone: "+1 555 010 2030",
    latitude: 43.5167,
    longitude: 4.9876,
  }).returning();
  if (!branch) throw new Error("seed: branch insert failed");

  await db.insert(openingHours).values(
    Array.from({ length: 7 }, (_, day) => ({
      branchId: branch.id, dayOfWeek: day, opensAt: "07:00", closesAt: "22:00", closed: false,
    })),
  );

  const [mainFloor] = await db.insert(zones).values({
    branchId: branch.id, name: "Main Floor", type: "MAIN_FLOOR", floorNumber: 0,
  }).returning();
  const [workspace] = await db.insert(zones).values({
    branchId: branch.id, name: "Focus Workspace", description: "Quiet area", type: "WORKSPACE", floorNumber: 0,
  }).returning();
  const [lounge] = await db.insert(zones).values({
    branchId: branch.id, name: "Window Lounge", type: "LOUNGE", floorNumber: 0,
  }).returning();
  const [meetingArea] = await db.insert(zones).values({
    branchId: branch.id, name: "Meeting Corner", type: "MEETING_AREA", floorNumber: 0,
  }).returning();
  if (!mainFloor || !workspace || !lounge || !meetingArea) throw new Error("seed: zone insert failed");

  await db.insert(staffZoneAssignments).values([
    { userId: waiterOne.id, zoneId: mainFloor.id },
    { userId: waiterOne.id, zoneId: lounge.id },
    { userId: waiterTwo.id, zoneId: workspace.id },
    { userId: waiterTwo.id, zoneId: meetingArea.id },
  ]);

  const seatRows = [
    // Main floor tables: two rows near the counter
    ...Array.from({ length: 6 }, (_, index) => ({
      branchId: branch.id, zoneId: mainFloor.id,
      name: `Table ${index + 1}`, type: "TABLE" as const, capacity: index < 3 ? 2 : 4,
      hourlyPriceCents: 0, nearWindow: false, hasPowerOutlet: index % 2 === 0, quietArea: false,
      positionX: -6 + (index % 3) * 3, positionY: 0, positionZ: index < 3 ? -2 : 1,
    })),
    // Focus desks along the back wall
    ...Array.from({ length: 5 }, (_, index) => ({
      branchId: branch.id, zoneId: workspace.id,
      name: `Desk ${index + 1}`, type: "WORK_DESK" as const, capacity: 1,
      hourlyPriceCents: 300, nearWindow: false, hasPowerOutlet: true, quietArea: true,
      positionX: -6 + index * 2.4, positionY: 0, positionZ: 5.5,
    })),
    // Window lounge seats
    ...Array.from({ length: 4 }, (_, index) => ({
      branchId: branch.id, zoneId: lounge.id,
      name: `Lounge ${index + 1}`, type: "LOUNGE_SEAT" as const, capacity: index === 3 ? 3 : 1,
      hourlyPriceCents: 0, nearWindow: true, hasPowerOutlet: false, quietArea: false,
      positionX: 6.5, positionY: 0, positionZ: -4 + index * 2.2,
      rotationY: -Math.PI / 2,
    })),
    // Meeting tables
    ...Array.from({ length: 2 }, (_, index) => ({
      branchId: branch.id, zoneId: meetingArea.id,
      name: `Meeting ${index + 1}`, type: "MEETING_TABLE" as const, capacity: 6,
      hourlyPriceCents: 1200, nearWindow: false, hasPowerOutlet: true, quietArea: false,
      positionX: -7 + index * 5, positionY: 0, positionZ: -6,
    })),
  ];
  const insertedSeats = await db.insert(seats).values(seatRows).returning();

  const [coffee] = await db.insert(menuCategories).values({
    branchId: branch.id, name: "Coffee & Espresso", displayOrder: 0,
  }).returning();
  const [food] = await db.insert(menuCategories).values({
    branchId: branch.id, name: "Pastries & Light Bites", displayOrder: 1,
  }).returning();
  if (!coffee || !food) throw new Error("seed: category insert failed");

  const insertedItems = await db.insert(menuItems).values([
    { categoryId: coffee.id, name: "Espresso", priceCents: 280 },
    { categoryId: coffee.id, name: "Flat White", priceCents: 420 },
    { categoryId: coffee.id, name: "Oat Latte", priceCents: 480 },
    { categoryId: coffee.id, name: "Filter Coffee", priceCents: 350 },
    { categoryId: food.id, name: "Butter Croissant", priceCents: 320 },
    { categoryId: food.id, name: "Avocado Toast", priceCents: 850 },
    { categoryId: food.id, name: "Granola Bowl", priceCents: 720 },
  ]).returning();

  const firstSeat = insertedSeats[0];
  const flatWhite = insertedItems[1];
  if (firstSeat && flatWhite) {
    const startAt = new Date();
    startAt.setUTCDate(startAt.getUTCDate() + 1);
    startAt.setUTCHours(9, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 2 * 3_600_000);

    const [reservation] = await db.insert(reservations).values({
      userId: customer.id, branchId: branch.id, seatId: firstSeat.id,
      startAt, endAt, partySize: 2, status: "CONFIRMED",
      reservationCode: generateReservationCode(),
    }).returning();

    if (reservation) {
      const [order] = await db.insert(orders).values({
        reservationId: reservation.id, userId: customer.id, branchId: branch.id,
        status: "SERVED", subtotalCents: 840, taxCents: 84, totalCents: 924,
      }).returning();
      if (order) {
        await db.insert(orderItems).values({
          orderId: order.id, menuItemId: flatWhite.id, quantity: 2,
          unitPriceCents: 420, totalPriceCents: 840,
        });
      }
    }
  }

  console.log("Seed complete. Development credentials (all share the password 'brewspace-dev-password'):");
  console.log("  admin@brewspace.dev / waiter1@brewspace.dev / waiter2@brewspace.dev / customer@brewspace.dev");
}

seed()
  .then(() => closeDatabase())
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
