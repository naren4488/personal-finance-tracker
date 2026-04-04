import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/page-loader"
import { endUserSession } from "@/lib/auth/end-session"
import { getRefreshToken } from "@/lib/auth/token"
import { useRefreshTokenMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

/** Dedupes session refresh across React Strict Mode’s double mount (avoids rotated-refresh races). */
let sessionBootstrap: Promise<void> | null = null

export function SessionRestore({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const [refreshToken] = useRefreshTokenMutation()
  const [ready, setReady] = useState(() => getRefreshToken() === null)

  useEffect(() => {
    if (!getRefreshToken()) {
      setReady(true)
      return
    }

    const run =
      sessionBootstrap ??
      (sessionBootstrap = (async () => {
        try {
          await refreshToken().unwrap()
        } catch {
          endUserSession(dispatch)
        } finally {
          sessionBootstrap = null
        }
      })())

    void run.finally(() => setReady(true))
  }, [dispatch, refreshToken])

  if (!ready) {
    return <PageLoader />
  }

  return <>{children}</>
}
