/**
 * Safely resolves the API Base URL.
 * Guarantees the URL ends with '/api' and has no trailing slashes.
 */
export const getApiBaseUrl = (): string => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "")
  return raw.endsWith("/api") ? raw : `${raw}/api`
}

export const API_BASE = getApiBaseUrl()

/**
 * Safely resolves the Backend Base URL (without /api suffix).
 * Guarantees no trailing slashes.
 */
export const getBackendBaseUrl = (): string => {
  return API_BASE.replace(/\/api$/, "")
}

export const BACKEND_BASE = getBackendBaseUrl()

