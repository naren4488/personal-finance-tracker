const ACCESS_KEY = "koin_access_token"
const REFRESH_KEY = "koin_refresh_token"
/** Legacy single-token key from earlier app versions */
const LEGACY_TOKEN_KEY = "koin_auth_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REFRESH_KEY)
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearToken(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}
