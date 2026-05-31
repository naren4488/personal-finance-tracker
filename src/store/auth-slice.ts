import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AuthUser } from "@/lib/api/auth-schemas"
import { getRefreshToken, getToken } from "@/lib/auth/token"

export type SessionStatus = "unknown" | "restoring" | "ready"

function readInitialSessionStatus(): SessionStatus {
  if (typeof window === "undefined") return "unknown"
  if (getRefreshToken() || getToken()) return "unknown"
  return "ready"
}

type AuthState = {
  user: AuthUser | null
  sessionStatus: SessionStatus
}

const initialState: AuthState = {
  user: null,
  sessionStatus: readInitialSessionStatus(),
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
    },
    patchUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    clearUser(state) {
      state.user = null
    },
    setSessionRestoring(state) {
      state.sessionStatus = "restoring"
    },
    setSessionReady(state) {
      state.sessionStatus = "ready"
    },
  },
})

export const { setUser, patchUser, clearUser, setSessionRestoring, setSessionReady } =
  authSlice.actions
