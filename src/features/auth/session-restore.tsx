import { useEffect, type ReactNode } from "react"
import { toast } from "sonner"
import { AuthSessionSplash } from "@/components/auth-session-splash"
import type { AuthUser } from "@/lib/api/auth-schemas"
import { getBackendToastMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { isAccessTokenExpired } from "@/lib/auth/jwt"
import { getRefreshToken, getToken } from "@/lib/auth/token"
import { baseApi, useRefreshTokenMutation } from "@/store/api/base-api"
import { setSessionReady, setSessionRestoring, setUser } from "@/store/auth-slice"
import { selectShowAuthSessionSplash } from "@/store/auth-selectors"
import { store } from "@/store"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

/** Dedupes session refresh across React Strict Mode’s double mount (avoids rotated-refresh races). */
let sessionBootstrap: Promise<void> | null = null

function hasStoredCredentials(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(getRefreshToken() || getToken())
}

export function SessionRestore({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const showSplash = useAppSelector(selectShowAuthSessionSplash)
  const [refreshToken] = useRefreshTokenMutation()

  useEffect(() => {
    if (typeof window === "undefined") {
      dispatch(setSessionReady())
      return
    }

    if (!hasStoredCredentials()) {
      dispatch(setSessionReady())
      return
    }

    dispatch(setSessionRestoring())

    const run =
      sessionBootstrap ??
      (sessionBootstrap = (async () => {
        try {
          if (getRefreshToken()) {
            await refreshToken().unwrap()
            return
          }

          const access = getToken()
          if (!access) return

          if (isAccessTokenExpired(access)) {
            throw new Error("token expired")
          }

          const user = await store
            .dispatch(
              baseApi.endpoints.getMe.initiate("", {
                subscribe: false,
                forceRefetch: true,
              })
            )
            .unwrap()
          dispatch(setUser(user as AuthUser))
        } catch (err) {
          const msg = getBackendToastMessage(err)
          endUserSession(dispatch)
          if (msg) {
            toast.error(msg)
          }
        } finally {
          sessionBootstrap = null
        }
      })())

    void run.finally(() => {
      dispatch(setSessionReady())
    })
  }, [dispatch, refreshToken])

  if (showSplash) {
    return <AuthSessionSplash />
  }

  return <>{children}</>
}
