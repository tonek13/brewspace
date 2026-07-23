import type {
  UserDto,
  BranchDto,
  OpeningHourDto,
  SeatDto,
  ReservationDto,
  ServiceRequestDto,
  ServiceRequestType,
  ServiceRequestStatus,
  OrderStatus,
} from "@brewspace/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fieldErrors?: ApiFieldError[] } };

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError("PARSE_ERROR", "The server returned an unexpected response.", response.status);
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload.error : null;
    throw new ApiError(
      error?.code ?? "UNKNOWN",
      error?.message ?? "Something went wrong. Please try again.",
      response.status,
      error?.fieldErrors ?? [],
    );
  }

  return payload.data;
}

// ---- Availability types (server-computed, not in contracts) ----
export type SeatAvailabilityState =
  | "AVAILABLE"
  | "HELD"
  | "RESERVED"
  | "OCCUPIED"
  | "UNAVAILABLE"
  | "MAINTENANCE";

export interface SeatAvailability {
  seat: SeatDto;
  state: SeatAvailabilityState;
}

export interface HoldDto {
  seatId: string;
  branchId: string;
  userId: string;
  startAt: string;
  endAt: string;
  partySize: number;
  token: string;
}

export interface MenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  available: boolean;
}

export interface MenuCategoryDto {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  items: MenuItemDto[];
}

export interface BranchMenuDto {
  categories: MenuCategoryDto[];
}

export interface OrderItemDto {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  notes: string | null;
}

export interface OrderDto {
  id: string;
  reservationId: string;
  userId: string;
  branchId: string;
  status: OrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  items?: OrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AvailabilityQuery {
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  durationMinutes: number;
  partySize: number;
}

export const api = {
  // ---- auth ----
  register: (body: { firstName: string; lastName: string; email: string; password: string }) =>
    apiFetch<UserDto>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    apiFetch<UserDto>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => apiFetch<{ success: true }>("/api/v1/auth/logout", { method: "POST" }),
  me: () => apiFetch<UserDto>("/api/v1/auth/me"),

  // ---- branches ----
  listBranches: () => apiFetch<BranchDto[]>("/api/v1/branches"),
  getBranch: (branchId: string) => apiFetch<BranchDto>(`/api/v1/branches/${branchId}`),
  getOpeningHours: (branchId: string) =>
    apiFetch<OpeningHourDto[]>(`/api/v1/branches/${branchId}/opening-hours`),

  // ---- seats / floor map ----
  getFloorMap: (branchId: string) =>
    apiFetch<{ seats: SeatDto[] }>(`/api/v1/branches/${branchId}/floor-map`),
  updateFloorMap: (
    branchId: string,
    seats: {
      seatId: string;
      positionX: number;
      positionY: number;
      positionZ: number;
      rotationX: number;
      rotationY: number;
      rotationZ: number;
      scaleX: number;
      scaleY: number;
      scaleZ: number;
    }[],
  ) =>
    apiFetch<SeatDto[]>(`/api/v1/admin/branches/${branchId}/floor-map`, {
      method: "PATCH",
      body: JSON.stringify({ seats }),
    }),

  // ---- availability ----
  getAvailability: (branchId: string, query: AvailabilityQuery) => {
    const params = new URLSearchParams({
      date: query.date,
      startTime: query.startTime,
      durationMinutes: String(query.durationMinutes),
      partySize: String(query.partySize),
    });
    return apiFetch<SeatAvailability[]>(`/api/v1/branches/${branchId}/availability?${params}`);
  },

  // ---- holds & reservations ----
  createHold: (seatId: string, body: { startAt: string; endAt: string; partySize: number }) =>
    apiFetch<HoldDto>(`/api/v1/seats/${seatId}/holds`, { method: "POST", body: JSON.stringify(body) }),
  releaseHold: (seatId: string, token: string) =>
    apiFetch<null>(`/api/v1/seats/${seatId}/holds`, {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),
  confirmReservation: (body: { holdToken: string; notes?: string }) =>
    apiFetch<ReservationDto>("/api/v1/reservations", { method: "POST", body: JSON.stringify(body) }),
  listReservations: (page = 1, pageSize = 20) =>
    apiFetch<Paginated<ReservationDto>>(`/api/v1/reservations?page=${page}&pageSize=${pageSize}`),
  cancelReservation: (id: string, reason?: string) =>
    apiFetch<ReservationDto>(`/api/v1/reservations/${id}/cancellations`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  extendReservation: (id: string, newEndAt: string) =>
    apiFetch<ReservationDto>(`/api/v1/reservations/${id}/extensions`, {
      method: "POST",
      body: JSON.stringify({ newEndAt }),
    }),
  checkIn: (id: string, reservationCode: string) =>
    apiFetch<ReservationDto>(`/api/v1/reservations/${id}/check-ins`, {
      method: "POST",
      body: JSON.stringify({ reservationCode }),
    }),

  // ---- menu & orders ----
  getMenu: (branchId: string) => apiFetch<BranchMenuDto>(`/api/v1/branches/${branchId}/menu`),
  submitOrder: (
    reservationId: string,
    body: { items: { menuItemId: string; quantity: number; notes?: string }[]; notes?: string },
  ) =>
    apiFetch<OrderDto>(`/api/v1/reservations/${reservationId}/orders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getOrder: (orderId: string) => apiFetch<OrderDto>(`/api/v1/orders/${orderId}`),

  // ---- service requests ----
  createServiceRequest: (reservationId: string, type: ServiceRequestType, message?: string) =>
    apiFetch<ServiceRequestDto>(`/api/v1/reservations/${reservationId}/service-requests`, {
      method: "POST",
      body: JSON.stringify({ type, message }),
    }),
  listReservationServiceRequests: (reservationId: string) =>
    apiFetch<ServiceRequestDto[]>(`/api/v1/reservations/${reservationId}/service-requests`),

  // ---- staff ----
  listStaffServiceRequests: () => apiFetch<ServiceRequestDto[]>("/api/v1/staff/service-requests"),
  updateServiceRequestStatus: (
    requestId: string,
    status: ServiceRequestStatus,
    rejectionReason?: string,
  ) =>
    apiFetch<ServiceRequestDto>(`/api/v1/staff/service-requests/${requestId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason }),
    }),
  listStaffOrders: () => apiFetch<OrderDto[]>("/api/v1/staff/orders"),
  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    apiFetch<OrderDto>(`/api/v1/staff/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ---- admin ----
  getDashboard: () => apiFetch<AdminDashboardDto>("/api/v1/admin/dashboard"),

  eventsUrl: (branchId: string) => `${API_URL}/api/v1/events?branchId=${branchId}`,
};

export interface AdminDashboardDto {
  summary: {
    active_reservations: number;
    active_check_ins: number;
    open_requests: number;
    daily_sales_cents: number;
  };
  popularSeats: { id: string; name: string; reservation_count: number }[];
  popularItems: { id: string; name: string; ordered_quantity: number }[];
  waiterResponseTimes: { assigned_waiter_id: string; avg_response_seconds: number }[];
}
