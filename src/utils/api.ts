const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  typeof envApiBaseUrl === "string" ? envApiBaseUrl.trim().replace(/\/$/, "") : "";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}