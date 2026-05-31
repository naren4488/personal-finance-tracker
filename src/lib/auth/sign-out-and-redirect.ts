import { toast } from "sonner"
import { endUserSession } from "@/lib/auth/end-session"
import type { AppDispatch } from "@/store"

let forcedSignOutInProgress = false

function isPublicAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register"
}

/**
 * Clears session and sends the user to Login.
 * Used when refresh fails or the access token is rejected after refresh.
 */
export function signOutAndRedirectToLogin(dispatch: AppDispatch, message?: string): void {
  if (forcedSignOutInProgress) return
  forcedSignOutInProgress = true

  endUserSession(dispatch)

  const trimmed = message?.trim()
  if (trimmed) {
    toast.error(trimmed)
  }

  if (typeof window !== "undefined") {
    const { pathname } = window.location
    if (!isPublicAuthRoute(pathname)) {
      window.location.assign("/login")
    }
  }

  window.setTimeout(() => {
    forcedSignOutInProgress = false
  }, 500)
}
