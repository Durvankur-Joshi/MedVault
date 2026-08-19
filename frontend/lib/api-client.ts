const API_BASE_URL = "http://localhost:8000";

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

// ─── API Client ──────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail?: string,
  ) {
    super(detail ?? `${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  // Automatically attach Authorization header if JWT exists
  const token = getToken();
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    headers: requestHeaders,
    ...rest,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, config);

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

export { ApiError };
