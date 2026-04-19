import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error
}

function flattenValidationErrors(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null
  const o = data as Record<string, unknown>
  const raw = o.errors
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const parts: string[] = []
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) parts.push(v.trim())
    else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string" && x.trim()) parts.push(x.trim())
      }
    }
  }
  return parts.length > 0 ? parts.join(" ") : null
}

function primaryMessageFromErrorData(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data.trim()
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>
    if (
      "success" in o &&
      o.success === false &&
      typeof o.message === "string" &&
      o.message.trim()
    ) {
      return o.message.trim()
    }
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.trim()
    }
  }
  return null
}

/** Prefer backend `message`; falls back to generic copy. */
export function getAuthErrorMessage(error: unknown): string {
  return getErrorMessage(error)
}

/** Human-readable message for toasts or error UI. */
export function getErrorMessage(error: unknown): string {
  if (isFetchBaseQueryError(error)) {
    if (error.status === "FETCH_ERROR") {
      return "Network error — check your connection."
    }
    if (error.status === "PARSING_ERROR") {
      return "Invalid response from server."
    }

    const fromFields = flattenValidationErrors(error.data)
    const primary = primaryMessageFromErrorData(error.data)

    if (error.status === 401) {
      const combined = primary ?? fromFields ?? ""
      if (/authorization|token|unauthori|login|required/i.test(combined) || combined.length === 0) {
        return "Please login again."
      }
      return combined || "Please login again."
    }

    if (fromFields && primary) {
      return `${primary} ${fromFields}`
    }
    if (fromFields) return fromFields
    if (primary) return primary

    if (typeof error.status === "number") {
      if (error.status === 500) {
        return "Server error (500). Check the API — see terminal/logs on the backend."
      }
      if (error.status === 502 || error.status === 503) {
        return "Service temporarily unavailable. Try again in a moment."
      }
    }
    return `Request failed (${String(error.status)})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Something went wrong."
}
