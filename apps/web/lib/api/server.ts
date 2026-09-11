import "server-only";
import { headers as nextHeaders } from "next/headers";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiResponseError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const incoming = await nextHeaders();
  const headers = new Headers(init.headers);
  const cookie = incoming.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; details?: string } | null;
    throw new ApiResponseError(response.status, payload?.error ?? payload?.details ?? `API hiba (${response.status})`);
  }
  return response.json() as Promise<T>;
}
