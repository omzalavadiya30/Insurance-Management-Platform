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

export type PolicyStatus = "draft" | "active" | "expired" | "cancelled";
export type PolicyType = "life" | "health" | "auto" | "home" | "travel" | "business";

export type Policy = {
  id: string;
  customerId: string;
  policyNumber: string;
  policyType: PolicyType;
  premiumAmount: number;
  startDate: string;
  endDate: string;
  status: PolicyStatus;
  createdAt: string;
  updatedAt: string;
};

export type PolicyCreatePayload = {
  policyType: PolicyType;
  premiumAmount: number;
  startDate: string;
  endDate: string;
  status?: PolicyStatus;
};

export type Claim = {
  id: string;
  policyId: string | null;
  claimAmount: number;
  reason: string;
  status: "submitted" | "approved" | "rejected";
  submissionDate: string;
};

export type PaymentRecord = {
  id: string;
  policyId: string | null;
  amount: number;
  paymentMethod: string;
  paymentStatus: "paid" | "pending" | "failed";
  paymentDate: string;
};

export type DocumentEntry = {
  id: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;
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

  mePolicies: (token: string) =>
    request<{ policies: Policy[] }>(`/customers/me/policies`, token),

  mePayments: (token: string) =>
    request<{ premiumPayments: PaymentRecord[] }>(`/customers/me/payments`, token),

  meDashboard: (token: string) =>
    request<{
      customer: Customer;
      policies: Policy[];
      claims: Claim[];
      documents: DocumentEntry[];
      premiumPayments: PaymentRecord[];
    }>(`/customers/dashboard`, token),

  getPayments: (token: string, customerId: string) =>
    request<{ premiumPayments: PaymentRecord[] }>(`/customers/${customerId}/payments`, token),

  getPolicies: (token: string, customerId: string) =>
    request<{ policies: Policy[] }>(`/customers/${customerId}/policies`, token),

  createPolicy: (
    token: string,
    customerId: string,
    body: PolicyCreatePayload
  ) =>
    request<{ policy: Policy }>(`/customers/${customerId}/policies`, token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitClaim: (
    token: string,
    body: { claimAmount: number; reason: string }
  ) =>
    request<{ claim: Claim }>("/customers/claims", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  recordPayment: (
    token: string,
    body: { amount: number; paymentMethod: string }
  ) =>
    request<{ payment: PaymentRecord }>("/customers/payments", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  uploadDocument: (
    token: string,
    body: { fileName: string; filePath: string }
  ) =>
    request<{ document: DocumentEntry }>("/customers/documents", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) =>
    request<{ customer: Customer }>("/customers/me", token),

  updateMe: (token: string, body: Pick<CustomerUpdatePayload, "fullName" | "phone" | "dateOfBirth" | "address">) =>
    request<{ customer: Customer }>("/customers/me", token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
