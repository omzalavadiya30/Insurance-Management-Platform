import { ApiError } from "./auth";

export type CustomerStatus = "active" | "disabled";

export type Customer = {
  id: string;
  userId: string | null;
  createdBy: string | null;
  customerCode: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  identityType: string | null;
  identityNumber: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerHistoryEvent = {
  id: string;
  type: "profile" | "policy" | "claim" | "payment" | "document";
  title: string;
  description: string;
  happenedAt: string;
  tone: "success" | "warning" | "info";
};

export type CustomerListResponse = {
  customers: Customer[];
  page: number;
  limit: number;
  total: number;
};

export type CustomerPayload = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  identityType: string;
  identityNumber: string;
  status?: CustomerStatus;
};

export type CustomerUpdatePayload = Partial<CustomerPayload>;

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  details?: Array<{ field: string; message: string }>;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api";

const request = async <T>(
  path: string,
  token: string,
  options: RequestInit = {}
) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.message || "The request could not be completed.",
      payload.details
    );
  }

  return payload;
};

const toQueryString = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export const customerApi = {
  list: (
    token: string,
    query: {
      search?: string;
      status?: CustomerStatus;
      page?: number;
      limit?: number;
    } = {}
  ) => request<CustomerListResponse>(`/customers${toQueryString(query)}`, token),

  create: (token: string, body: CustomerPayload) =>
    request<{ customer: Customer }>("/customers", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getById: (token: string, customerId: string) =>
    request<{ customer: Customer }>(`/customers/${customerId}`, token),

  update: (token: string, customerId: string, body: CustomerUpdatePayload) =>
    request<{ customer: Customer }>(`/customers/${customerId}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  history: (token: string, customerId: string) =>
    request<{ customer: Customer; history: CustomerHistoryEvent[] }>(
      `/customers/${customerId}/history`,
      token
    ),

  me: (token: string) =>
    request<{ customer: Customer }>("/customers/me", token),

  updateMe: (token: string, body: Pick<CustomerUpdatePayload, "fullName" | "phone" | "dateOfBirth" | "address">) =>
    request<{ customer: Customer }>("/customers/me", token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
