"use client";

const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers =
    new Headers(
      init.headers,
    );

  const isFormData =
    typeof FormData !==
      "undefined" &&
    init.body instanceof
      FormData;

  if (
    init.body &&
    !isFormData &&
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  return fetch(
    `${API_URL}${path}`,
    {
      ...init,
      headers,
      credentials:
        "include",
    },
  );
}
