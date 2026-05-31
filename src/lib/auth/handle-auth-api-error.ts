import { toast } from "sonner"
import { getBackendToastMessage, isFetchBaseQueryError } from "@/lib/api/errors"
import { signOutAndRedirectToLogin } from "@/lib/auth/sign-out-and-redirect"
import type { AppDispatch } from "@/store"

/** True when the backend message indicates the session is no longer valid. */
export function isAuthFailureMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("authorization token is required") ||
    lower.includes("token expired") ||
    lower.includes("invalid or expired refresh token") ||
    lower.includes("invalid refresh token") ||
    (lower.includes("refresh token") && lower.includes("expired"))
  )
}

/** True for HTTP 401 or known auth-failure backend messages. */
export function isAuthFailureError(err: unknown): boolean {
  if (isFetchBaseQueryError(err) && err.status === 401) {
    return true
  }
  return isAuthFailureMessage(getBackendToastMessage(err))
}

export type HandleAuthApiErrorOptions = {
  /** Called before forced logout (e.g. close a modal). */
  onDismiss?: () => void
}

/**
 * Forced logout when `err` is an auth failure.
 * @returns true if logout was triggered
 */
export function handleAuthApiErrorIfNeeded(
  err: unknown,
  dispatch: AppDispatch,
  options?: HandleAuthApiErrorOptions
): boolean {
  if (!isAuthFailureError(err)) {
    return false
  }
  options?.onDismiss?.()
  const msg = getBackendToastMessage(err)
  signOutAndRedirectToLogin(dispatch, msg)
  return true
}

/**
 * API error handler: forced logout on auth failure, otherwise toast the backend message.
 * Use in forms, pages, and sheets for consistent session teardown.
 */
export function handleAuthApiError(
  err: unknown,
  dispatch: AppDispatch,
  options?: HandleAuthApiErrorOptions
): void {
  if (handleAuthApiErrorIfNeeded(err, dispatch, options)) {
    return
  }
  toast.error(getBackendToastMessage(err))
}

/** @deprecated Prefer `isAuthFailureMessage` */
export const isAuthTokenRequiredMessage = isAuthFailureMessage
