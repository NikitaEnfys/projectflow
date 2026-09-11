import { redirect } from "next/navigation";
import type { AuthMeResponse, AuthUser } from "@projectflow/contracts";
import { ApiResponseError, serverApi } from "@/lib/api/server";

export type CurrentUser = AuthUser;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await serverApi<AuthMeResponse>("/api/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 401) return null;
    throw error;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
