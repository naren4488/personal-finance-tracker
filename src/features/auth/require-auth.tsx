import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { selectAuthUser } from "@/store/auth-selectors"
import { useAppSelector } from "@/store/hooks"

/**
 * SessionRestore blocks the router until session validation completes.
 * This guard only checks validated Redux user state — never localStorage tokens.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const user = useAppSelector(selectAuthUser)

  if (!user) {
    const from = location.pathname === "/profile" ? undefined : location.pathname
    return <Navigate to="/login" replace state={from ? { from } : undefined} />
  }

  return <>{children}</>
}
