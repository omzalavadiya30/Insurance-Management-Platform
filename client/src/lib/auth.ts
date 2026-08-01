export type AuthRole = "admin" | "agent" | "customer";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

export type AuthNotice = {
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  details?: Array<{ field: string; message: string }>;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000/api";

const STORAGE_KEY = "insurance_auth_session";
const NOTICE_KEY = "insurance_auth_notice";

class ApiError extends Error {
  details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

const request = async <T>(
  path: string,
  options: RequestInit & { token?: string } = {}
) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

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

export const authApi = {
  register: (body: {
    fullName: string;
    email: string;
    password: string;
    role: AuthRole;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
  }) =>
    request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string; role: AuthRole }) =>
    request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: { email: string }) =>
    request<never>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetPassword: (body: { token: string; password: string }) =>
    request<never>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) =>
    request<{ user: AuthUser; session: { id: string; expiresAt: string } }>(
      "/auth/me",
      {
        method: "GET",
        token,
      }
    ),

  logout: (token: string) =>
    request<never>("/auth/logout", {
      method: "POST",
      token,
    }),
};

export const saveSession = (session: AuthSession) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const savePendingNotice = (notice: AuthNotice) => {
  window.sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
};

export const consumePendingNotice = (): AuthNotice | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawNotice = window.sessionStorage.getItem(NOTICE_KEY);

  if (!rawNotice) {
    return null;
  }

  window.sessionStorage.removeItem(NOTICE_KEY);

  try {
    return JSON.parse(rawNotice) as AuthNotice;
  } catch {
    return null;
  }
};

export const getStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearSession = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};

export { ApiError };
