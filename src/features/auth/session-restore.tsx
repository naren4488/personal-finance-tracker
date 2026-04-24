import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/page-loader"
import type { AuthUser } from "@/lib/api/auth-schemas"
import { endUserSession } from "@/lib/auth/end-session"
import { getRefreshToken, getToken } from "@/lib/auth/token"
import { baseApi, useRefreshTokenMutation } from "@/store/api/base-api"
import { setUser } from "@/store/auth-slice"
import { store } from "@/store"
import { useAppDispatch } from "@/store/hooks"

/** Dedupes session refresh across React Strict Mode’s double mount (avoids rotated-refresh races). */
let sessionBootstrap: Promise<void> | null = null

function hasStoredCredentials(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(getRefreshToken() || getToken())
}

export function SessionRestore({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const [refreshToken] = useRefreshTokenMutation()
  const [ready, setReady] = useState(() => !hasStoredCredentials())

  useEffect(() => {
    if (typeof window === "undefined") {
      setReady(true)
      return
    }

    if (!hasStoredCredentials()) {
      setReady(true)
      return
    }

    const run =
      sessionBootstrap ??
      (sessionBootstrap = (async () => {
        try {
          if (getRefreshToken()) {
            await refreshToken().unwrap()
            return
          }
          if (getToken()) {
            const user = await store
              .dispatch(
                baseApi.endpoints.getMe.initiate("", {
                  subscribe: false,
                  forceRefetch: true,
                })
              )
              .unwrap()
            dispatch(setUser(user as AuthUser))
          }
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
