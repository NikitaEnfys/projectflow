"use client";
import type { LoginRequest, RegisterRequest } from "@projectflow/contracts";
import { apiFetch } from "@/lib/api/client";

export async function login(email: string, password: string) {
  const body: LoginRequest = { email, password };
  return apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export async function register(name: string, email: string, password: string, next: string) {
  const body: RegisterRequest = { name, email, password, next };
  return apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export async function logout() {
  return apiFetch("/api/auth/logout", { method: "POST" });
}
