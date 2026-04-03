import { Navigate } from "react-router-dom"
import { getToken } from "@/lib/auth/token"

/** Send logged-in users away from login/register. */
export function RedirectIfAuthed() {
  if (getToken()) {
    return <Navigate to="/" replace />
  }
  return null
}
