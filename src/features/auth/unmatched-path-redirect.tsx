import { Navigate } from "react-router-dom"
import { getToken } from "@/lib/auth/token"

/** Use as the last route for URLs that do not match /login, /register, or the app shell. */
export function UnmatchedPathRedirect() {
  return <Navigate to={getToken() ? "/" : "/login"} replace />
}
