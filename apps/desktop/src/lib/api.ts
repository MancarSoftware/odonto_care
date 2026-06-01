import { LOCAL_API_DEFAULT_URL } from "@odontocare/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? LOCAL_API_DEFAULT_URL;

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
