import { apiClient } from "@/lib/api-client";
import type { TokenResponse, User, UserRole } from "@/types";

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  return apiClient.post<TokenResponse>("/api/auth/login", payload);
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return apiClient.post<User>("/api/auth/register", payload);
}

export async function getCurrentUser(): Promise<User> {
  return apiClient.get<User>("/api/auth/me");
}
