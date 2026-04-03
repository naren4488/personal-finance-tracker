import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error
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
    if (typeof error.data === "string" && error.data) {
      return error.data
    }
    if (
      typeof error.data === "object" &&
      error.data !== null &&
      "success" in error.data &&
      (error.data as { success: unknown }).success === false &&
      "message" in error.data &&
      typeof (error.data as { message: unknown }).message === "string"
    ) {
      return (error.data as { message: string }).message
    }
    if (
      typeof error.data === "object" &&
      error.data !== null &&
      "message" in error.data &&
      typeof (error.data as { message: unknown }).message === "string"
    ) {
      return (error.data as { message: string }).message
    }
    return `Request failed (${String(error.status)})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Something went wrong."
}
