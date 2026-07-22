import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  doublePrecision,
  smallint,
  time,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["CUSTOMER", "WAITER", "ADMIN"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED"]);
export const seatTypeEnum = pgEnum("seat_type", [
  "TABLE",
  "WORK_DESK",
  "MEETING_TABLE",
  "LOUNGE_SEAT",
  "SOFA",
]);
export const seatStatusEnum = pgEnum("seat_status", ["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"]);
export const zoneTypeEnum = pgEnum("zone_type", [
  "MAIN_FLOOR",
  "WORKSPACE",
  "MEETING_AREA",
  "LOUNGE",
  "OUTDOOR",
]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "HELD",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
]);
export const serviceRequestTypeEnum = pgEnum("service_request_type", [
  "CALL_WAITER",
  "REQUEST_MENU",
  "REQUEST_WATER",
  "REQUEST_ASSISTANCE",
  "REQUEST_BILL",
  "OTHER",
]);
export const serviceRequestStatusEnum = pgEnum("service_request_status", [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
]);
export const menuOptionTypeEnum = pgEnum("menu_option_type", ["SINGLE", "MULTIPLE"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
]);

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  address: text("address").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const openingHours = pgTable("opening_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  dayOfWeek: smallint("day_of_week").notNull(),
  opensAt: time("opens_at").notNull(),
  closesAt: time("closes_at").notNull(),
  closed: boolean("closed").notNull().default(false),
}, (table) => [
  uniqueIndex("opening_hours_branch_day_unique").on(table.branchId, table.dayOfWeek),
  check("opening_hours_day_of_week_check", sql`${table.dayOfWeek} >= 0 AND ${table.dayOfWeek} <= 6`),
]);

export const zones = pgTable("zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  type: zoneTypeEnum("type").notNull(),
  floorNumber: integer("floor_number").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (table) => [
  index("zones_branch_id_idx").on(table.branchId),
]);

export const seats = pgTable("seats", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  zoneId: uuid("zone_id").notNull().references(() => zones.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  type: seatTypeEnum("type").notNull(),
  capacity: integer("capacity").notNull(),
  status: seatStatusEnum("status").notNull().default("AVAILABLE"),
  description: text("description"),
  reservable: boolean("reservable").notNull().default(true),
  hourlyPriceCents: integer("hourly_price_cents"),
  nearWindow: boolean("near_window").notNull().default(false),
  hasPowerOutlet: boolean("has_power_outlet").notNull().default(false),
  quietArea: boolean("quiet_area").notNull().default(false),
  positionX: doublePrecision("position_x").notNull().default(0),
  positionY: doublePrecision("position_y").notNull().default(0),
  positionZ: doublePrecision("position_z").notNull().default(0),
  rotationX: doublePrecision("rotation_x").notNull().default(0),
  rotationY: doublePrecision("rotation_y").notNull().default(0),
  rotationZ: doublePrecision("rotation_z").notNull().default(0),
  scaleX: doublePrecision("scale_x").notNull().default(1),
  scaleY: doublePrecision("scale_y").notNull().default(1),
  scaleZ: doublePrecision("scale_z").notNull().default(1),
  ...timestamps,
}, (table) => [
  index("seats_branch_id_idx").on(table.branchId),
  index("seats_zone_id_idx").on(table.zoneId),
  check("seats_capacity_check", sql`${table.capacity} > 0`),
]);

/**
 * Overlap prevention: a PostgreSQL exclusion constraint using btree_gist keeps two
 * active reservations (HELD, CONFIRMED or CHECKED_IN) from ever holding the same
 * seat for overlapping time ranges — enforced by the database itself, so it holds
 * even under concurrent requests racing past application-level checks. Applied via
 * raw SQL in the migration since Drizzle's schema builder has no exclusion-constraint
 * API; the reservations repository documents this in detail.
 */
export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
  seatId: uuid("seat_id").notNull().references(() => seats.id, { onDelete: "restrict" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  partySize: integer("party_size").notNull(),
  status: reservationStatusEnum("status").notNull().default("HELD"),
  reservationCode: varchar("reservation_code", { length: 12 }).notNull(),
  notes: text("notes"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  ...timestamps,
}, (table) => [
  uniqueIndex("reservations_code_unique").on(table.reservationCode),
  index("reservations_seat_id_idx").on(table.seatId),
  index("reservations_user_id_idx").on(table.userId),
  check("reservations_time_range_check", sql`${table.endAt} > ${table.startAt}`),
]);

export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  assignedWaiterId: uuid("assigned_waiter_id").references(() => users.id, { onDelete: "set null" }),
  zoneId: uuid("zone_id").notNull().references(() => zones.id, { onDelete: "restrict" }),
  type: serviceRequestTypeEnum("type").notNull(),
  message: text("message"),
  status: serviceRequestStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
}, (table) => [
  index("service_requests_zone_status_idx").on(table.zoneId, table.status),
  index("service_requests_reservation_id_idx").on(table.reservationId),
]);

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  available: boolean("available").notNull().default(true),
}, (table) => [
  check("menu_items_price_check", sql`${table.priceCents} >= 0`),
]);

export const menuItemOptions = pgTable("menu_item_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  type: menuOptionTypeEnum("type").notNull(),
  required: boolean("required").notNull().default(false),
  minSelections: integer("min_selections").notNull().default(0),
  maxSelections: integer("max_selections").notNull().default(1),
});

export const menuItemOptionValues = pgTable("menu_item_option_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  optionId: uuid("option_id").notNull().references(() => menuItemOptions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  additionalPriceCents: integer("additional_price_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").notNull().default("DRAFT"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  index("orders_reservation_id_idx").on(table.reservationId),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
  notes: text("notes"),
}, (table) => [
  check("order_items_quantity_check", sql`${table.quantity} > 0`),
]);

export const orderItemOptions = pgTable("order_item_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  optionValueId: uuid("option_value_id").notNull().references(() => menuItemOptionValues.id, { onDelete: "restrict" }),
  nameSnapshot: varchar("name_snapshot", { length: 120 }).notNull(),
  priceSnapshotCents: integer("price_snapshot_cents").notNull(),
});

export const staffZoneAssignments = pgTable("staff_zone_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  zoneId: uuid("zone_id").notNull().references(() => zones.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
}, (table) => [
  uniqueIndex("staff_zone_assignments_unique").on(table.userId, table.zoneId),
]);

export const branchesRelations = relations(branches, ({ many }) => ({
  zones: many(zones),
  seats: many(seats),
  openingHours: many(openingHours),
}));
export const zonesRelations = relations(zones, ({ one, many }) => ({
  branch: one(branches, { fields: [zones.branchId], references: [branches.id] }),
  seats: many(seats),
}));
export const seatsRelations = relations(seats, ({ one, many }) => ({
  branch: one(branches, { fields: [seats.branchId], references: [branches.id] }),
  zone: one(zones, { fields: [seats.zoneId], references: [zones.id] }),
  reservations: many(reservations),
}));
export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  user: one(users, { fields: [reservations.userId], references: [users.id] }),
  seat: one(seats, { fields: [reservations.seatId], references: [seats.id] }),
  serviceRequests: many(serviceRequests),
  orders: many(orders),
}));
