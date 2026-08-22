export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 25000;

// Log API Base URL once in development (safe, non-sensitive)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(`[API] Base URL: ${API_BASE_URL}`);
}

// Public endpoints that must never have Authorization headers attached
const PUBLIC_ENDPOINTS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/health",
];

const ERROR_MAP: Record<string, string> = {
  "Invalid authentication credentials": "Your session is invalid or has expired. Please sign in again.",
  "Your session has expired. Please sign in again.": "Your session has expired. Please sign in again.",
  "No active consent granted to access this medical record": "Access Denied: No active patient consent found for this record.",
  "Consent has expired. The patient needs to grant new consent.": "Consent Expired: The patient's access consent period has elapsed.",
  "Access was revoked by the patient": "Consent Revoked: The patient has revoked access to this record.",
  "ZK authorization proof is invalid": "Zero-Knowledge Verification Failed: Cryptographic authorization proof could not be validated.",
};

/**
 * Centralized API client. All backend calls go through this module —
 * never use fetch directly in UI components.
 *
 * JWT token is stored in localStorage for this hackathon MVP.
 * TODO: Migrate authentication to secure HttpOnly cookies / stronger session architecture in production.
 *
 * Security Rules:
 * - Never store raw passwords in browser storage.
 * - Never store plaintext medical record contents in localStorage.
 * - Never store encryption keys in localStorage.
 * - Never expose JWT in URL parameters.
 * - Never log passwords, tokens, or medical payloads.
 */

// ─── Token Management ────────────────────────────────────────────────
// JWT stored in localStorage contains only: sub (user_id), role, exp.
// Never store medical data, encryption keys, or FHIR data here.

const TOKEN_KEY = "medvault_jwt";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return getToken();
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

// ─── API Client ──────────────────────────────────────────────────────

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail?: string
  ) {
    super(detail ?? `${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  // Attach Authorization header if JWT exists and endpoint is not public
  const isPublic = PUBLIC_ENDPOINTS.some((pub) => endpoint.startsWith(pub));
  if (!isPublic) {
    const token = getToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  // 25-second abort controller timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config: RequestInit = {
    headers: requestHeaders,
    signal: controller.signal,
    ...rest,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        408,
        "Request Timeout",
        "MedVault backend request timed out. Please check backend connectivity."
      );
    }

    // Network error / Connection refused / Server unreachable / CORS failure
    throw new ApiError(
      0,
      "Network Error",
      `Unable to connect to the MedVault backend service (${API_BASE_URL}). Please ensure the backend server is running and accessible.`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // If backend returns 401 Unauthorized, clear invalid token
    if (response.status === 401) {
      clearToken();
    }

    let detail: string | undefined;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail;
    } catch {
      // Response body is not JSON
    }

    if (detail && typeof detail === "string") {
      const mapped = ERROR_MAP[detail];
      if (mapped) {
        detail = mapped;
      }
    } else if (!detail) {
      if (response.status === 500) {
        detail = "Internal server error. Please verify backend logs and database connection.";
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        detail = "MedVault backend service is temporarily unavailable.";
      } else if (response.status === 404) {
        detail = "Requested medical resource or endpoint was not found.";
      } else if (response.status === 403) {
        detail = "Access forbidden. Required authorization or cryptographic consent is missing.";
      } else if (response.status === 401) {
        detail = "Your session has expired. Please sign in again.";
      }
    }

    throw new ApiError(response.status, response.statusText, detail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
