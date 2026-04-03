import { getApiBaseUrl } from "@/lib/env"
import type { AuthResult } from "@/lib/api/auth-schemas"

const PREFIX = "[Koin auth]"

/** Auth request/response logging (dev only). */
export function isAuthApiDebugEnabled(): boolean {
  return import.meta.env.DEV
}

/** Browser URL for the request (relative base becomes same-origin). */
export function resolveAuthRequestUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "")
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}${path}`
  }
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}${base.startsWith("/") ? base : `/${base}`}${path}`
}

export function logAuthRequestStart(
  operation: "register" | "login",
  path: string,
  method: string,
  body: unknown
): void {
  if (!isAuthApiDebugEnabled()) return

  console.groupCollapsed(`${PREFIX} ${operation} — before API call`)
  console.log("Step: form passed validation → RTK mutation → network request")
  console.log("Method:", method)
  console.log("Path:", path)
  console.log("Base URL (from env):", getApiBaseUrl())
  console.log("Full URL (resolved):", resolveAuthRequestUrl(path))
  console.log("Request body (object):", body)
  console.log("Request body (JSON):", JSON.stringify(body, null, 2))
  console.log(
    "Expected shape:",
    operation === "register"
      ? '{ "name": string, "email": string, "password": string }'
      : '{ "email": string, "password": string }'
  )
  console.groupEnd()
}

export function logAuthResponseSuccess(operation: "register" | "login", rawData: unknown): void {
  if (!isAuthApiDebugEnabled()) return

  console.groupCollapsed(`${PREFIX} ${operation} — after API success`)
  console.log("Step: HTTP OK and body accepted by app logic")
  console.log("Raw response (from fetch):", rawData)
  console.log("Raw response (JSON):", JSON.stringify(rawData, null, 2))
  console.groupEnd()
}

export function logAuthResponseParsed(operation: "register" | "login", result: AuthResult): void {
  if (!isAuthApiDebugEnabled()) return

  console.groupCollapsed(`${PREFIX} ${operation} — parsed result (tokens redacted)`)
  console.log("User:", result.user)
  console.log(
    "accessToken length:",
    result.accessToken.length,
    "| preview:",
    previewSecret(result.accessToken)
  )
  console.log(
    "refreshToken length:",
    result.refreshToken.length,
    "| preview:",
    previewSecret(result.refreshToken)
  )
  console.log("Step: tokens → localStorage; user → Redux (onQueryStarted)")
  console.groupEnd()
}

export function logAuthFailure(
  operation: "register" | "login",
  phase: "http" | "success-false" | "parse",
  error: unknown,
  userMessage?: string
): void {
  if (!isAuthApiDebugEnabled()) return

  console.groupCollapsed(`${PREFIX} ${operation} — after API failure (${phase})`)
  console.error("Step: request failed or response rejected by app")
  console.error("Error object:", error)
  if (userMessage) {
    console.error("Message for user (toast/UI):", userMessage)
  }
  console.groupEnd()
}

function previewSecret(value: string, visible = 10): string {
  if (value.length <= visible) return "(short)"
  return `${value.slice(0, visible)}… (${value.length} chars)`
}
