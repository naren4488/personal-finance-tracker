import { Navigate } from "react-router-dom"
import { selectAuthUser } from "@/store/auth-selectors"
import { useAppSelector } from "@/store/hooks"

/** Send validated logged-in users away from login/register. */
export function RedirectIfAuthed() {
  const user = useAppSelector(selectAuthUser)

  if (user) {
    return <Navigate to="/" replace />
  }

  return null
}
