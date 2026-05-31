import { Navigate } from "react-router-dom"
import { selectAuthUser } from "@/store/auth-selectors"
import { useAppSelector } from "@/store/hooks"

/** Use as the last route for URLs that do not match /login, /register, or the app shell. */
export function UnmatchedPathRedirect() {
  const user = useAppSelector(selectAuthUser)
  return <Navigate to={user ? "/" : "/login"} replace />
}
