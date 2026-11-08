/**
 * Central auth client helpers.
 *
 * Backend auth now ALSO accepts an httpOnly cookie set at login / Google
 * callback (`credentials: "include"`), so browsers do not need to persist
 * the JWT in JS-readable storage. The Authorization header is still
 * supported for older flows and API clients.
 *
 * Rules:
 * - NEVER build a header from a null/undefined/empty token — that produces
 *   "Bearer null" and a 401 jwt-malformed round-trip.
 * - Prefer authFetch() for new code.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem("token")
  if (!raw || raw === "null" || raw === "undefined" || !raw.trim()) return null
  return raw.trim()
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * fetch() with auth wired: includes cookies and attaches the Authorization
 * header only when a real token exists.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.headers || {}),
      ...authHeaders(),
    },
  })
}

export { API_BASE }
