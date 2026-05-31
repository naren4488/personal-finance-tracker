/** Decode JWT `exp` (seconds since epoch) when the access token is a JWT. */
export function getJwtExpiryMs(token: string): number | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown
    }
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null
    return payload.exp * 1000
  } catch {
    return null
  }
}

/** True when JWT `exp` is in the past (with optional skew). Non-JWT tokens return false. */
export function isAccessTokenExpired(token: string, skewMs = 30_000): boolean {
  const expMs = getJwtExpiryMs(token)
  if (expMs == null) return false
  return Date.now() >= expMs - skewMs
}

/** Human-readable remaining lifetime when JWT `exp` is present. */
export function formatAccessTokenLifetime(token: string): string | null {
  const expMs = getJwtExpiryMs(token)
  if (expMs == null) return null
  const hours = Math.round((expMs - Date.now()) / (60 * 60 * 1000))
  if (!Number.isFinite(hours)) return null
  return `${hours}h`
}
