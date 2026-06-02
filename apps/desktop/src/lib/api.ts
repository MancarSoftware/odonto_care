import { LOCAL_API_DEFAULT_URL } from "@odontocare/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? LOCAL_API_DEFAULT_URL;

type ApiRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | undefined;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const requestInit: RequestInit = {
    headers,
    method: options.method ?? "GET",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestInit.body = JSON.stringify(options.body);
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, requestInit);

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const error = (await response.json()) as { error?: unknown };
      if (typeof error.error === "string") {
        message = error.error;
      } else if (
        error.error &&
        typeof error.error === "object" &&
        "message" in error.error
      ) {
        const errorMessage = (error.error as { message?: unknown }).message;
        message = Array.isArray(errorMessage)
          ? errorMessage.join(", ")
          : String(errorMessage);
      }
    } catch {
      // Keep the transport-level message when the API returns no JSON body.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, token?: string): Promise<T> {
  return apiRequest<T>(path, { token });
}

export function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  return apiRequest<T>(path, { body, method: "POST", token });
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  return apiRequest<T>(path, { body, method: "PATCH", token });
}

export function apiPut<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  return apiRequest<T>(path, { body, method: "PUT", token });
}

export function apiDelete<T>(path: string, token?: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE", token });
}
