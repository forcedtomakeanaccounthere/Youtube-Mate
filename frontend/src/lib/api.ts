/**
 * Safely resolves the API Base URL.
 * Guarantees the URL ends with '/api' and has no trailing slashes.
 */
export const getApiBaseUrl = (): string => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "")
  return raw.endsWith("/api") ? raw : `${raw}/api`
}

export const API_BASE = getApiBaseUrl()

